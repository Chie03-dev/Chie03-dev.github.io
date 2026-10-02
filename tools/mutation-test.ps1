param()
$root = 'd:\Developers\Projects\portfolio'
Set-Location $root
$bak = Join-Path $env:TEMP 'smokebak'
# Wipe it first. A stale backup directory is worse than none: it can hold a copy
# of a file that has since been split or deleted, Restore then writes that
# outdated copy back over the real source, and the next run reports a fault it
# never injected. That happened - the whole sky painter was restored to a
# pre-split version and the suite then "caught" a fault it had left behind.
Remove-Item -Recurse -Force $bak -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $bak | Out-Null
# DISCOVERED, NOT LISTED. This used to be a hand-written array of eleven module
# names, and a new module simply was not in it - so it was never backed up and
# never restored. cave.js hit this on its first run: mutation 43 left it with
# `return false` in caveActive(), every later cave fault then reported "SETUP
# FAILED (pattern not found)" because the pattern it was looking for had been
# mutated away, and the survivors list came back EMPTY - which reads exactly like
# a clean result. Five faults silently stopped testing anything.
#
# The lesson is the one the array was originally introduced to fix (see the note
# below it about biomes-sky.js and place.js): a hand-maintained list of the
# things to remember will eventually not be updated. So it is derived from the
# directory instead, and a module cannot be added to the project without also
# being protected from a mutation run.
$files = @(Get-ChildItem js\*.js | ForEach-Object { $_.Name })
$cssFiles = @(Get-ChildItem css\*.css | ForEach-Object { $_.Name })
Copy-Item ($files | ForEach-Object { Join-Path 'js' $_ }) $bak -Force
Copy-Item ($cssFiles | ForEach-Object { Join-Path 'css' $_ }) $bak -Force
# index.html is mutated too (mutation 35 hides the loot), so it has to be
# backed up and restored like everything else. Leaving it out meant that
# mutation left the document permanently broken for every run after it.
Copy-Item index.html $bak -Force
# Fail loudly if the backup is not what we think it is, rather than silently
# restoring something stale.
foreach ($f in $files) {
  if (-not (Test-Path (Join-Path $bak $f))) {
    Write-Output ("BACKUP INCOMPLETE: " + $f + " is missing - refusing to run")
    exit 1
  }
}
# And check the restore, not just the backup. A backup that is taken and never
# written back is indistinguishable from no backup at all until the next run
# fails to find its pattern.
Write-Output ("backing up " + $files.Count + " modules and " +
              $cssFiles.Count + " stylesheets")
# A HASH of every backed-up file, taken before any fault runs. The end of the run
# compares against it, which is the only way to prove the tree came back: git
# cannot, because the tree is legitimately dirty with uncommitted work, and
# "dirty" is exactly the state every run of this script starts in.
$before = @{}
foreach ($f in $files) { $before[$f] = (Get-FileHash (Join-Path 'js' $f) -Algorithm SHA256).Hash }
foreach ($f in $cssFiles) { $before[$f] = (Get-FileHash (Join-Path 'css' $f) -Algorithm SHA256).Hash }
$before['index.html'] = (Get-FileHash index.html -Algorithm SHA256).Hash

function Restore {
  Copy-Item ($files | ForEach-Object { Join-Path $bak $_ }) js\ -Force
  Copy-Item ($cssFiles | ForEach-Object { Join-Path $bak $_ }) css\ -Force
  Copy-Item $bak\index.html . -Force
}

function Mutate($name, $file, $from, $to) {
  $t = Get-Content $file -Raw
  # Line endings are normalised before matching. This file is written with LF but
  # the sources are CRLF, so a pattern written with a plain newline never matched
  # - and "pattern not found" is indistinguishable from "someone already applied
  # this fault", which is how a real restore failure gets reported as a healthy
  # run. It happened twice here: mutation 14b reported SETUP FAILED while the file
  # was in fact correct, and the run's empty survivors list read as a pass.
  $nl = if ($t.Contains("`r`n")) { "`r`n" } else { "`n" }
  $fromN = $from -replace "`r?`n", $nl
  $toN = $to -replace "`r?`n", $nl
  if (-not $t.Contains($fromN)) {
    Write-Output ("  SETUP FAILED (pattern not found) " + $name)
    Write-Output ("        in " + $file + " - nothing was changed, so this fault " +
                  "tested NOTHING. A green survivors list below does not mean it passed.")
    return
  }
  [System.IO.File]::WriteAllText((Join-Path $root $file), $t.Replace($fromN, $toN))
  $out = (node tools\smoke.mjs 2>&1 | Out-String)
  $code = $LASTEXITCODE
  $hit = ($out -split "`r?`n" | Where-Object { $_ -match 'FAIL|SMOKE (FAILED|ERRORED|PASSED)' } | Select-Object -First 1)
  if (-not $hit) { $hit = '(no failure reported)' }
  Write-Output ("  exit=" + $code + "  " + $name)
  Write-Output ("        -> " + (($hit -replace '\s+', ' ').Trim()))
  Restore
  # Verify THIS file came back, immediately, while the fault that broke it is
  # still the subject. Checking only at the end of the run is too late: the
  # failure is invisible until several faults later, by which point nobody can
  # tell which one caused it - and Restore silently does nothing when the backup
  # lacks the file, which is exactly how it failed here.
  $nowHash = (Get-FileHash (Join-Path $root $file) -Algorithm SHA256).Hash
  if ($nowHash -ne $before[[System.IO.Path]::GetFileName($file)]) {
    Write-Output ("        !! RESTORE FAILED for " + $file + " - the tree is now")
    Write-Output ("           BROKEN and every later fault will test it. Aborting.")
    exit 1
  }
}

# The same idea, but judged by the PIXEL test instead of the smoke test.
#
# This exists because smoke cannot see two whole classes of bug. Its canvas stub
# records which operations were called, not what colour came out, so a sheared
# tree crown and a completely static sky both sail straight through it - both
# mutations below were reported as "SMOKE PASSED" until the pixel test existed.
# Running the browser suite for these makes the claim "the checks catch
# regressions" honest rather than aspirational.
#
# It is slow (six real browser runs per mutation), so it is used only where smoke
# is provably blind, not for every mutation.
function MutatePixel($name, $file, $from, $to) {
  $t = Get-Content $file -Raw
  if (-not $t.Contains($from)) { Write-Output ("  SETUP FAILED (pattern not found) " + $name); return }
  [System.IO.File]::WriteAllText((Join-Path $root $file), $t.Replace($from, $to))
  $out = (node tools\pixel-test.mjs 2>&1 | Out-String)
  $code = $LASTEXITCODE
  # Match a FAILURE line, not any line containing the word "failed": the summary
  # reads "0 failed" on a passing run, so a loose 'failed' pattern reported
  # "0 skipped, 0 failed" as the headline and made a caught mutation look clean.
  $hit = ($out -split "`r?`n" | Where-Object { $_ -match '\bFAIL\b|PIXEL TEST FAILED' } | Select-Object -First 1)
  if (-not $hit) { $hit = 'PIXEL TEST PASSED - NOT CAUGHT' }
  Write-Output ("  exit=" + $code + "  " + $name)
  Write-Output ("        -> " + (($hit -replace '\s+', ' ').Trim()))
  Write-Output ("        (judged by the pixel test; smoke calls this PASSED)")
  Restore
}


Write-Output ''
Write-Output 'MUTATION TEST: does the smoke check actually catch regressions?'
Write-Output ''
Mutate '1. syntax error (stray */)' 'js\render.js' 'framed at all times, and the rope length is still honestly the distance from' 'framed at all times, and the rope length is still honestly the distance from */'
Mutate '2. car travels backwards' 'js\deck.js' 'return b.top + p * (b.bot - b.top);' 'return b.bot - p * (b.bot - b.top);'
Mutate '3. NaN geometry (silent drop)' 'js\deck.js' 'return Math.max(10, deckBounds().top - (SPRITE_H + 30));' 'return NaN;'
Mutate '4. band pushed off centre' 'js\deck.js' 'var DECK_CENTRE = 0.5;' 'var DECK_CENTRE = 0.92;'
Mutate '5. travel starts in the sky' 'js\layers.js' 'travelFrom = dirt >= 0 ? dirt :' 'travelFrom = dirt >= 0 ? 0 :'
Mutate '6. travel runs past the foot of the dig' 'js\layers.js' 'travelTo = deepest >= 0 ? deepest :' 'travelTo = deepest >= 0 ? deepest + 900 :'
Mutate 'parked car ignores the surface' 'js\deck.js' '  return soil;' '  return b.top;'
Mutate 'seatDeck clamps the car back into the band' 'js\deck.js' '  deckY = clamp(deckY, floor, ceil);' '  deckY = clamp(deckY, b.top, b.bot);'
Mutate 'parked on the dirt room, not the grass' 'js\deck.js' '  var soil = surfaceFrom - scrollY;' '  var soil = travelFrom - scrollY;'
Mutate 'the band overrides the grass line' 'js\deck.js' '  return soil;' '  return soil > b.top ? soil : b.top;'
Mutate 'target ignores the ground' 'js\deck.js' '  if (p <= 0) return parkedY();' '  // mutant'
Mutate 'the parked car eases toward the ground' 'js\deck.js' '  if (reduced || snapToParked()) {' '  if (reduced) {'
Mutate 'a re-seat centres the parked car' 'js\deck.js' '    deckY = snapToParked() ? parkedY() : (b.top + b.bot) / 2;' '    deckY = (b.top + b.bot) / 2;'
Mutate 'the band ignores the surface' 'js\deck.js' '  if (surfaceFrom > 0 && surfaceFrom < top) top = surfaceFrom;' '  if (surfaceFrom > 0 && surfaceFrom > top) top = surfaceFrom;'
Mutate 'the travel window starts at the dirt room' 'js\deck.js' '  var start = surfaceFrom > 0 ? surfaceFrom : travelFrom;' '  var start = travelFrom;'
Mutate 'the surface anchor is unclamped' 'js\deck.js' '  if (surfaceFrom > 0 && surfaceFrom < top) top = surfaceFrom;' '  if (surfaceFrom > 0) top = surfaceFrom;'
Mutate 'the descent is stretched over the whole page' 'js\deck.js' '  var end = Math.min(travelTo, start + viewH);' '  var end = travelTo;'
Mutate '7. travel window never closes' 'js\deck.js' 'if (!(end > start)) end = maxScroll + 1;' 'if (end > start) end = start;'
Mutate '8. no barrier above the cave' 'js\layers.js' 'travelTo = Math.max(travelTo - Math.max(1, viewH), travelFrom + 1);' 'travelTo = Math.max(travelTo, travelFrom + 1);'
# 9, 9b, 10 and 11 are GONE. They attacked the shaft channel: a CSS mask cut into
# the treasure room's ::before, the --ch width derived from the shaft token, and
# the room painting its own background over that channel. All four are deleted
# with the room element. The channel existed because the room's opaque HTML
# background buried the sprite standing in the cave; with the room gone the cave
# and the player are both canvas, there is no HTML over them, and the failure
# cannot occur. Smoke's stylesheet check for the channel went with it, and
# mutation 35 ("the car stays visible after the player leaves it") is now judged
# from recorded draw calls - a behavioural check where 2b used to be a textual
# one.
Mutate '12. biomes never place art' 'js\biomes.js' 'var g = gutters(layer);' 'var g = []; var _unused = gutters(layer);'
Mutate '13. panel geometry not measured' 'js\layers.js' 'left: Math.round(rect.left),' 'left: 0,'
Mutate '14. no grass tufts on the surface' 'js\sprites.js' "SET.tufts = [bakeTuft(9, 6, PAL.leaf, r), bakeTuft(7, 4, PAL.leaf, r)];" "SET.tufts = [];"
# 14b is the bare-meadow bug, and it is the reason the surface read as empty.
# The two sheet crops are 83x96 and 62x72 and the desktop gutter is 48px, so
# asking for an integer scale (1 or 2) could only ever draw a tree WIDER than the
# strip it stood in - one per gutter, two on the whole page. Shrinking the CROWN
# GAP, which is what was tried first, changes nothing: the walk cursor is already
# past the end of the gutter after the first tree. Only a target width fixes it.
Mutate '14b. trees sized by integer scale, not to fit' 'js\biome-sky.js' 'blitOn(spr, walk, seamPropY(below, walk + wide / 2) + TREE_SINK, gu.w, wide);' 'blitOn(spr, walk, seamPropY(below, walk + wide / 2) + TREE_SINK, gu.w);'
# 14e: blitOn() quantizes magnification to the nearest half-step so an upscaled
# tree keeps a regular pixel grid. Removing it is what an earlier version of this
# line did (it clamped to Math.min(2, ...)), and the trees then draw at whatever
# arbitrary factor TREE_W implies - 86px onto an 83px crop is 1.036x, where some
# source columns double and their neighbours do not. The smoke check that every
# drawn width is one the painter would actually ask for is what catches this: the
# unquantized widths are in none of the allowed buckets.
Mutate '14e. magnification not quantized to half-steps' 'js\place.js' 'if (k > 1) k = Math.max(1, Math.round(k * 2) / 2);' 'if (k > 1) k = Math.max(1, k);'
# 14f: and the other direction - rounding UP to the next half-step instead of to
# the nearest one. This still produces clean pixels, so nothing about crispness
# catches it, and the trees are all roughly the right size. What it destroys is
# the SPREAD: an 86px target is 1.04x of the 83px crop, so rounding up draws it at
# 1.5x = 125px, and the smallest entry in TREE_W comes out the same size as the
# largest. The stand becomes one hedge again. Only a size-set check sees this.
Mutate '14f. magnification rounded up instead of to nearest' 'js\place.js' 'if (k > 1) k = Math.max(1, Math.round(k * 2) / 2);' 'if (k > 1) k = Math.max(1, Math.ceil(k * 2) / 2);'
# 14g: the trees CRAWLED against their own soil while the page scrolled, and this
# is the only fault here that no existing check could see. seamY() returned a
# FRACTIONAL y, and its two consumers disagreed: render.js strokes it into a path,
# so the browser antialiases the seam and it slides smoothly, while blitOn()
# rounds the sprite's destination, so a tree only ever lands on a whole pixel. At
# fractional scroll offsets the two drift apart by up to half a pixel and the
# meadow shimmers against its own ground line.
#
# It survived because every frame-comparison check in the suite holds scroll
# STILL, and at a still scroll the two consumers agree perfectly well. The bug
# only exists in the DIFFERENCE between them, so comparing frames cannot see it.
# The sub-pixel check added to smoke.mjs walks 16 scroll offsets at quarter-pixel
# steps - every residue of the rounding - and asserts the placement values are
# whole numbers. Reverting the round() fails it at all 16 offsets.
#
# One fault, not two: dropping just the Math.round leaves a stray paren and turns
# this into a syntax error, which would "fail" the run for a reason that has
# nothing to do with the check under test. A mutation that only breaks parsing
# proves nothing, so the whole return statement is replaced in one substitution.
Mutate '14g. seam not rounded, so trees crawl against the soil' 'js\layers.js' '  return Math.round(layer.top - scrollY +' '  return (layer.top - scrollY +'
# 14h: the trees TWITCHED, and only SOME of them, which is the part that made this
# hard to find. The turf clip traces the seam every SEAM_STEP and the browser joins
# those vertices with straight lines, so the visible ground between two vertices is
# the CHORD. A tree sampling seamY() at its own x got the true curve instead, which
# is up to 5px from the chord it is standing on - so scrolling moved the two past
# each other and the tree juddered inside its own shadow. Whether a given tree was
# affected depended only on where it fell between two vertices, which is why it
# looked arbitrary.
#
# Three earlier versions of this check all failed to catch it, and each failure is
# worth recording: asserting no tree moves UP while scrolling passed, because the
# chord error is a constant offset and the tree still descends smoothly; comparing
# the drawn base to the chord derived from the DRAWN width reported 2.50px on
# correct code, because the painter samples at walk + TARGET/2 and the drawn width
# is the quantized result of that target; and a quarter-pixel grid sweep flagged a
# quarter of the trees on correct code, because the chord is a straight line and a
# grid steps over it. The check that works solves for the crossing point instead.
Mutate '14h. trees placed on the curve, not the drawn chord' 'js\biome-sky.js' 'blitOn(spr, walk, seamPropY(below, walk + wide / 2) + TREE_SINK, gu.w, wide);' 'blitOn(spr, walk, seamY(below, walk + wide / 2) + TREE_SINK, gu.w, wide);'
# 14i: the same fault in the other two prop call sites. A grass tuft off the chord
# is far less noticeable than a tree, which is precisely why it survived - so it is
# asserted rather than left to visual QA.
Mutate '14i. grass tufts placed on the curve, not the chord' 'js\biome-sky.js' 'blitOn(gt, tx, seamPropY(below, tx) - 1, viewW);' 'blitOn(gt, tx, seamY(below, tx) - 1, viewW);'
# 14j: and the helper itself, reverted to a curve reader. With seamPropY() correct
# but unused, the placement check above is what catches this - it asks whether each
# drawn tree can be explained by the chord at all.
Mutate '14j. seamPropY reads the curve instead of the chord' 'js\layers.js' '  var y0 = seamY(layer, x0);' '  var y0 = seamY(layer, x);'
# 14d is the bare-LEFT-side bug, and it is a different failure from 14b. The props
# were placed with gutters(), which excludes the panel's whole horizontal column.
# That is correct for a painter filling a band top to bottom and wrong for props
# standing on the seam, because the seam is half a row-gap BELOW the panel. At
# 1440 the gutters came back [48, 602]: the left half of the surface got no
# trees at all while the count still looked healthy. The both-sides assertion in
# smoke.mjs is what catches this - a plain density floor does not, because the
# total was never low.
Mutate '14d. props placed in band gutters, not meadow gutters' 'js\biomes.js' 'var g = meadowGutters();' 'var g = gutters(layers[i]);'
# 14c: the flowers were drawn INSIDE the tree loop, so their count was capped by
# the tree count. With two trees on the page that was 0.6 flowers.
Mutate '14c. ground cover coupled to the tree count' 'js\biome-sky.js' 'for (walk = gu.x; walk < gu.x + gu.w; walk += COVER_STEP) {' 'for (walk = gu.x; walk < gu.x + gu.w; walk += COVER_STEP) { if (placed > 2) break;'
Mutate '15. flowers reduced to three colours' 'js\sprites.js' "  { petal: '#5ee0ff', petalDim: '#1f92c4', core: '#eafcff' },  /* cyan    */" ''
Mutate '16. no trees on the surface layer' 'js\sprites.js' "SET.canopies = [bakeCanopy(21, 19, PAL.leaf, r), bakeCanopy(26, 23, PAL.leaf, r)];" "SET.canopies = [];"
# The old #17 ("no crystal in the caves") was removed with the rock
# decorations it targeted - SET.crystals no longer exists, so the mutation had
# nothing to patch. Numbering below is left as-is to keep the diff readable.
Mutate '18. baker called without its height' 'js\sprites.js' 'bakeCanopy(21, 19, PAL.leaf, r)' 'bakeCanopy(21, PAL.leaf, r)'
Mutate '19. blit a sprite with a zero destination' 'js\place.js' 'return Math.max(1, Math.min(2, Math.floor(room / spr.width) || 1));' 'return 0;'
# seamNoise was folded into seamY; mulberry32 is the import render.js still
# imports AND uses (seedMotes), so dropping it is the same black-canvas bug.
Mutate '20. import dropped but still used (black canvas)' 'js\render.js' 'seamY, mulberry32, SHAFT_TINT' 'seamY, SHAFT_TINT'
# 21 and 22 cover the two bugs found in visual QA on 2026-09-30: the broadleaf
# crown was sheared flat across the top, and the sun/clouds never moved. Both
# are INVISIBLE to the smoke check - it stubs the canvas, so it records which
# draw calls happened but never what colour came out, and a flat-topped tree and
# a frozen sky are both perfectly valid call sequences. That is precisely why
# tools/pixel-test.mjs exists, and why these two are judged by it.
# The 2026-09-30 sheared crown was `k = t` - a half-ellipse measured straight
# down from the top row, so the widest row was y=0. An earlier version of this
# mutation set `shoulder = 0.0001` instead, which was a NO-OP: that makes the
# top row a single pixel and the crown more pointed, not flatter. The mutation
# ran clean and I nearly read that as the pixel test being weak.
MutatePixel '21. broadleaf crown sheared flat across the top' 'js\sprites.js' 'var k = t <= shoulder ? (shoulder - t) / shoulder : (t - shoulder) / (1 - shoulder);' 'var k = t;'
MutatePixel '22. sun and clouds frozen (scroll-keyed, not time-keyed)' 'js\biome-sky.js' 'var clock = reduced ? 0 : (isFinite(now) ? now / 1000 : 0);' 'var clock = 0;'
# 23 is the meadow that reshuffled itself several times a second, reported by the
# user as "sometimes the trees move". The whole sky biome used to draw its clouds
# and its trees from ONE seeded stream, and the cloud loop's off-screen
# `continue` is tested against a clock-derived x - so a cloud drifting out of a
# gutter skipped the density draw that follows it, the stream advanced by a
# different amount each frame, and the trees read it downstream. Every sprite
# stayed valid, in a gutter, standing on the ground. Nothing could see it but a
# check that renders twice and compares.
# The fix was a dedicated stream for the props, so the mutation makes that stream
# advance once per call - the same symptom as the original bug (a different
# layout per frame) without needing a clock threaded through three files, which
# a single-file replace cannot do. `globalThis` is used for the counter so the
# replacement stays one self-contained line and needs no declaration.
# Note the smoke test CAN see this one - it is not a pixel-only bug, it is a
# determinism bug - which is why it is a plain Mutate and not a MutatePixel.
# The cloud stream is separate from the props stream, so contamination can only
# happen if the props read a frame-dependent stream. Mutating the SEED rather than
# the call is what makes this a real test of the invariant: the pattern has to
# match the tree loop's own mulberry32 call, which is `rt`, not `r` - the cover
# pass took `rc` when the two streams were split, so the old `r() < 0.6` pattern
# stopped matching and this mutation silently stopped testing anything.
Mutate '23. props stream re-contaminated per frame' 'js\biome-sky.js' 'var rt = mulberry32(PROP_SEED);' 'var rt = mulberry32(PROP_SEED + ((((globalThis.__propFrame = (globalThis.__propFrame || 0) + 1) * 7) | 0)));'
# 24 is the one the user reported as "the dirt tile is above the green line it
# should be below it". The seam is a jagged curve, but the soil filled from a
# STRAIGHT bandTop and the turf was a flat rect, so both were free to paint over
# each other at the boundary - and because the seam wanders +/-13px, they did:
# the turf's lower 23 rows are the cell's own SOIL, and wherever the seam ran
# high they sat above the grass line.
# Two clips fix it, one per side of the boundary, and EITHER ONE ALONE IS STILL
# THE BUG: clip only the soil and the turf's soil rows are left above the line;
# clip only the grass and the green seam line ends up stranded on bare dirt.
# So this mutation removes the GRASS clip, which is the half the smoke test
# cannot otherwise distinguish from correct - it leaves the soil clip intact and
# every draw call finite, so nothing else in the suite reacts.
Mutate '24. grass no longer clipped above the seam' 'js\biome-sky.js' 'ctx.lineTo(viewW + 40, ground - TURF_TOP);
    ctx.closePath();
    ctx.clip();' 'ctx.lineTo(viewW + 40, ground - TURF_TOP);
    ctx.closePath();'
# 25-28 cover the band/panel split. Before it a layer band WAS its section rect,
# so the opaque chamber covered the entire middle of its own rock and the only
# visible art was whatever survived in the gutters. bands.js now derives each
# band from the midpoints of the gaps above and below the panel. These four
# attack the ways that can go wrong, each with a different visible symptom:
#   25 collapses the band back onto the panel    -> the original bug returns
#   26 leaves a hole between bands                -> unpainted strip across the page
#   27 drops the array reset in measure()         -> layers accumulate per re-measure
#   28 shrinks the row-gap that feeds the headroom -> the seam sits on the panel edge
Mutate '25. band collapses back onto its panel' 'js\bands.js' '? Math.round((prev.panelBottom + panels[i].panelTop) / 2)' '? panels[i].panelTop'
Mutate '26. bands leave an unpainted strip between them' 'js\bands.js' '? Math.round((panels[i].panelBottom + next.panelTop) / 2)' '? next.panelTop + 40'
Mutate '27. measure() appends layers instead of rebuilding' 'js\layers.js' '  layers = [];' '  /* mutated: no reset */'
Mutate '28. row-gap too small to show the seam' 'css\layout.css' 'row-gap:clamp(14rem, 46vh, 34rem);' 'row-gap:2rem;'


# === The bedrock cave =====================================================
# The cave is the newest physics in the project and the least exercised, so each
# of its load-bearing decisions gets a fault. Without these the smoke checks
# could be asserting nothing at all - and three of the cave assertions below were
# themselves wrong on the first run (they blamed the room for a velocity that
# main.js sets, a player the test had re-seated onto the car, and a scroll range
# where the room is not on screen), which is exactly the situation where a
# mutation is the only honest proof that a passing check means something.

# 29: the floor stops being a profile. This is the "the player cannot move" bug
# in its original form - a flat line, so walking is horizontal only and the room
# is a corridor. The relief assertion is what catches it.
Mutate '29. cave floor flattened' 'js\cave.js' 'var FLOOR_RELIEF = 22;' 'var FLOOR_RELIEF = 0;'
# 30: the floor stops being finite for an unmeasured cave. This is the one that
# took the longest to find by hand: screenFloorY() returns NaN, the collision
# writes it into player.y, and every draw from it is dropped by the canvas with no
# error anywhere. The non-finite check is the only thing that sees it.
Mutate '30. unmeasured cave floor dereferences a null room' 'js\cave.js' '  if (!room) return NaN;' ''
# 42: the floor never parks, so it walks up the viewport and off the top of it,
# taking the player with it. Caught by the floor-inside-the-viewport sweep, and
# originally reported only as "the character left the screen" at five viewports -
# a message pointing at the player rather than at the floor.
Mutate '31. cave floor never parks in the viewport' 'js\cave.js' '  if (isFinite(park) && park > 0 && y < park) y = park;' ''
# 31b: the park line itself. It used to be a fraction of the viewport, and BOTH
# values that were tried were wrong in a way nothing else caught: 0.72 clamped the
# floor flat for the cave's entire active range (a corridor with a straight line
# down it - the exact thing this feature exists to avoid), and 0.30 failed at
# 300x200 where a third of the viewport is 60px and the player is 64px tall. It is
# caveFloorParkY() now, and this fault removes the sprite-height term from it.
Mutate '31b. park line ignores the sprite height' 'js\cave.js' '  var min = CAVE_SPRITE_MIN + 2 + FLOOR_RELIEF;' '  var min = 0;'
# 32: the cave is never entered. The gate stays closed, the player rides the car
# the whole way down, and the room is exactly as it was before this feature.
Mutate '32. the cave never activates' 'js\cave.js' '  return room.top - (window.scrollY || 0) < h * 0.5;' '  return false;'
# 33: the walls go, so the player walks off the side of the screen and the next
# frame draws a sprite and its lantern pool centred off-canvas.
Mutate '33. cave walls removed' 'js\game.js' '  if (player.x < b.left) { player.x = b.left; player.vx = 0; }' '  if (false) { player.x = b.left; player.vx = 0; }'
# 34: the collision samples the floor at the player's FEET instead of their
# centre. Subtle and worth a fault of its own: the feet are two sample-widths
# apart on a slope, so the sprite ends up standing on the wrong part of the curve
# - sliding as they walk it, which is the meadow-twitch bug again with the player
# as the prop.
Mutate '34. cave floor sampled at the feet, not the centre' 'js\game.js' '  var floorY = screenFloorY(cx);' '  var floorY = screenFloorY(player.x);'
# 34 was re-pointed here. It used to target a `var ground = screenFloorY(...)`
# line in movePlayerCave() that duplicated the sampling movePlayerCave() already
# did. That second sample sat behind a branch a settled player never reached, so
# the mutation survived every check in the suite while the number it sampled was
# dead. The duplication is gone; there is now exactly one place the floor is read
# for collision, and that is what this attacks.
# 35: the car stays drawn while the player has left it - an empty car hanging over
# the room. Nothing in the smoke suite checks this, because it is a rendering
# judgement rather than a coordinate: the hoist simply stops being drawn.
Mutate '35. the car stays visible after the player leaves it' 'js\render.js' '  if (player.inCave) return;' '  if (false) return;'
# 36: the roof's small-viewport guard. CAVE_HEIGHT itself is NOT worth a fault: it
# is only ever an upper bound, and caveRoof() clamps it against the floor before
# applying it, so multiplying it by four produces an identical result - an
# equivalent mutant, which a surviving check is the CORRECT response to. It was
# tried as 'CAVE_HEIGHT * 4' and survived, correctly.
#
# The guard that actually decides the roof on a short window is the maxByHead
# clamp. Remove it and the roof goes above the top of the frame at 300x200, where
# the room parks 60px down and the cave is nominally 300px tall - which the
# ceiling clamp reports as the player being off screen, a message pointing at the
# player rather than at the roof.
Mutate '36. cave roof ignores the sprite height' 'js\cave.js' '    var maxByHead = floor - CAVE_SPRITE_MIN - 1;' '    var maxByHead = floor + 400;'

Write-Output ''
Write-Output 'restored - confirming the tree is clean again:'
node tools\smoke.mjs 2>&1 | Select-Object -Last 1
node tools\pixel-test.mjs 2>&1 | Select-Object -Last 2
# AND the mutation harness itself verifies the restore, because a fault that fails
# to put its file back leaves the NEXT run testing a tree that is already broken:
# every later fault reports "pattern not found" and the survivors line comes back
# empty, which reads exactly like a clean result. That happened here - five
# consecutive cave faults reported SETUP FAILED while the real problem was one
# unrestored file from the fault before them. A green end-of-run line is not
# evidence that anything was restored.
if ((git status --porcelain 2>$null) -match '\S') {
  Write-Output ''
  Write-Output 'WARNING: the working tree is dirty after the mutation run.'
  Write-Output 'A fault did not restore its file, so the results above are not'
  Write-Output 'trustworthy. Check the list below before trusting a survivor count:'
  git --no-pager status --short
}
