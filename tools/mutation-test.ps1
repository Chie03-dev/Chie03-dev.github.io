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
# Kept as one array so the backup and the restore can never drift apart, which
# is how biomes-sky.js and place.js came to be backed up but not restored.
$files = @('render.js','deck.js','layers.js','biomes.js','biome-sky.js',
           'place.js','sprites.js','main.js','bands.js','avatar.js','treasure.js')
Copy-Item ($files | ForEach-Object { Join-Path 'js' $_ }) $bak -Force
Copy-Item css\layout.css, css\chambers.css, css\treasure.css $bak -Force
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

function Restore {
  Copy-Item ($files | ForEach-Object { Join-Path $bak $_ }) js\ -Force
  Copy-Item $bak\layout.css, $bak\chambers.css, $bak\treasure.css css\ -Force
  Copy-Item $bak\index.html . -Force
}

function Mutate($name, $file, $from, $to) {
  $t = Get-Content $file -Raw
  if (-not $t.Contains($from)) { Write-Output ("  SETUP FAILED (pattern not found) " + $name); return }
  [System.IO.File]::WriteAllText((Join-Path $root $file), $t.Replace($from, $to))
  $out = (node tools\smoke.mjs 2>&1 | Out-String)
  $code = $LASTEXITCODE
  $hit = ($out -split "`r?`n" | Where-Object { $_ -match 'FAIL|SMOKE (FAILED|ERRORED|PASSED)' } | Select-Object -First 1)
  if (-not $hit) { $hit = '(no failure reported)' }
  Write-Output ("  exit=" + $code + "  " + $name)
  Write-Output ("        -> " + (($hit -replace '\s+', ' ').Trim()))
  Restore
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

# The same idea, judged by the HOARD test instead of the smoke test.
#
# The hoard lives in its own suite (tools/hoard-test.mjs) because smoke.mjs was
# already over the 500-line cap and the hoard is the only part of the page whose
# failures are SPATIAL - a loot panel that never collapses, a chest laid across
# the shaft channel. Smoke's stub DOM cannot see any of that, so judging these
# mutations with smoke would report every one of them as a clean pass.
function MutateHoard($name, $file, $from, $to) {
  $t = Get-Content $file -Raw
  if (-not $t.Contains($from)) { Write-Output ("  SETUP FAILED (pattern not found) " + $name); return }
  [System.IO.File]::WriteAllText((Join-Path $root $file), $t.Replace($from, $to))
  $out = (node tools\hoard-test.mjs 2>&1 | Out-String)
  $code = $LASTEXITCODE
  $hit = ($out -split "`r?`n" | Where-Object { $_ -match '\bFAIL\b|HOARD TEST FAILED' } | Select-Object -First 1)
  if (-not $hit) { $hit = 'HOARD TEST PASSED - NOT CAUGHT' }
  Write-Output ("  exit=" + $code + "  " + $name)
  Write-Output ("        -> " + (($hit -replace '\s+', ' ').Trim()))
  Write-Output ("        (judged by the hoard test; smoke calls this PASSED)")
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
Mutate '6. travel runs past the treasure' 'js\layers.js' 'travelTo = treasure >= 0 ? treasure :' 'travelTo = treasure >= 0 ? treasure + 900 :'
Mutate '7. travel window never closes' 'js\deck.js' 'if (!(end > start)) end = maxScroll + 1;' 'if (end > start) end = start;'
Mutate '8. no barrier above the treasure room' 'js\layers.js' 'travelTo = Math.max(travelTo - Math.max(1, viewH), travelFrom + 1);' 'travelTo = Math.max(travelTo, travelFrom + 1);'
Mutate '9. shaft channel cut only in Safari-prefixed form' 'css\layout.css' '  -webkit-mask-image:linear-gradient(90deg,#000 0,' '  -webkit-mask-image:none;--gone:linear-gradient(90deg,#000 0,'
Mutate '9b. shaft channel has no unprefixed mask' 'css\layout.css' '  mask-image:linear-gradient(90deg,#000 0,' '  mask-image:none;--gone:linear-gradient(90deg,#000 0,'
Mutate '10. channel width hardcoded to zero' 'css\layout.css' '--ch:calc((var(--shaft-w) + 2 * var(--col-gap)) / 2);' '--ch:0px;'
Mutate '11. room paints over its own channel' 'css\chambers.css' 'background:none;border:0;box-shadow:none;' 'background:var(--panel-solid);border:0;box-shadow:none;'
Mutate '12. biomes never place art' 'js\biomes.js' 'var g = gutters(layer);' 'var g = []; var _unused = gutters(layer);'
Mutate '13. panel geometry not measured' 'js\layers.js' 'left: Math.round(rect.left),' 'left: 0,'
Mutate '14. no grass tufts on the surface' 'js\sprites.js' "SET.tufts = [bakeTuft(9, 6, PAL.leaf, r), bakeTuft(7, 4, PAL.leaf, r)];" "SET.tufts = [];"
# 14b is the bare-meadow bug, and it is the reason the surface read as empty.
# The two sheet crops are 83x96 and 62x72 and the desktop gutter is 48px, so
# asking for an integer scale (1 or 2) could only ever draw a tree WIDER than the
# strip it stood in - one per gutter, two on the whole page. Shrinking the CROWN
# GAP, which is what was tried first, changes nothing: the walk cursor is already
# past the end of the gutter after the first tree. Only a target width fixes it.
Mutate '14b. trees sized by integer scale, not to fit' 'js\biome-sky.js' 'blitOn(spr, walk, seamY(below, walk + wide / 2) + TREE_SINK, gu.w, wide);' 'blitOn(spr, walk, seamY(below, walk + wide / 2) + TREE_SINK, gu.w);'
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

# 29-38 cover the hoard (js/treasure.js, css/treasure.css, index.html). Each
# attacks a different failure, and every one of them is invisible to the eye
# until it is invisible to a reader. All are judged by the HOARD test, because
# smoke's stub DOM cannot see the spatial ones at all:
#   29 gold is never returned on close      -> the tally only ever goes up
#   30 the room never lights                -> the whole point of collecting
#   31 loot stays aria-hidden when opened   -> screen readers get nothing
#   32 loot is not aria-hidden when shut    -> screen readers read closed chests
#   33 aria-expanded is never set           -> state is visual-only
#   34 the hoard covers the shaft channel   -> the room's opening is buried
#   35 the loot is marked hidden            -> no-JS visitors lose the copy
#   36 the phone grid keeps the shaft track -> an empty gutter in a 1-col room
#   37 the loot has no inner wrapper        -> the panel never actually closes
#   38 the focus ring is removed            -> keyboard users lose the cursor
#
# 37 is not hypothetical: with two <p> children and no wrapper, the panel
# measured 84px shut and 84px open in a real browser, because grid-template-rows
# constrains the first row only. That defect passed every stub-based check.
MutateHoard '29. gold is never returned on close' 'js\treasure.js' "      found -= (isFinite(back) && back > 0) ? back : 0;" '      /* mutated: gold is not returned */'
MutateHoard '30. the room never lights up' 'js\treasure.js' "  room.style.setProperty('--gold', total > 0 ? (found / total).toFixed(3) : '0');" "  room.style.setProperty('--gold', '0');"
MutateHoard '31. opened loot stays aria-hidden' 'js\treasure.js' "      if (loot) loot.setAttribute('aria-hidden', 'false');" '      /* mutated: loot never unhidden */'
MutateHoard '32. shut loot is not aria-hidden' 'js\treasure.js' "      if (panel) panel.setAttribute('aria-hidden', 'true');" '      /* mutated: never hidden */'
MutateHoard '33. aria-expanded is never updated' 'js\treasure.js' "      chest.setAttribute('aria-expanded', 'true');" '      /* mutated: state is visual only */'
MutateHoard '34. a stack covers the shaft channel' 'css\treasure.css' '  grid-template-columns:1fr var(--shaft-w) 1fr;' '  grid-template-columns:1fr;'
MutateHoard '35. the loot is marked hidden in the markup' 'index.html' '<div class="chest__loot" id="loot-till">' '<div class="chest__loot" id="loot-till" hidden>'
MutateHoard '36. the phone row keeps the shaft track' 'css\treasure.css' '  .vault__row{grid-template-columns:1fr;row-gap:var(--space-md)}' '  .vault__row{row-gap:var(--space-md)}'
# 37 is a two-line pattern, so it is built as a here-string rather than a
# double-quoted literal: PowerShell would try to expand $(...) and the quotes
# inside, and the mutation would silently never match.
$from37 = @'
<div class="chest__loot-in">
                <p>An offline-first Android POS
'@
$to37 = @'
<div class="chest__loot-notin">
                <p>An offline-first Android POS
'@
MutateHoard '37. the loot has no single inner wrapper' 'index.html' $from37 $to37
MutateHoard '38. the chest focus ring is removed' 'css\treasure.css' '.chest:focus-visible{
  outline:3px solid var(--accent);
  outline-offset:2px;
}' '.chest:focus-visible{outline:none}'

# 39 folds the two stacks back into one container. It is the regression this
# change was made to prevent, and the one a visual glance cannot catch: side by
# side, a single three-track grid with cells placed in columns 1 and 3 looks
# almost identical. The difference only shows when a chest opens and the shared
# implicit rows push the far side down a row.
$from39 = @'
<div class="vault__row" id="vault-grid">
        <ul class="vault__stack vault__stack--left">
'@
$to39 = @'
<div class="vault__row" id="vault-grid">
        <ul class="vault__grid">
'@
MutateHoard '39. the two stacks are merged back into one list' 'index.html' $from39 $to39

Write-Output ''
Write-Output 'restored - confirming the tree is clean again:'
node tools\smoke.mjs 2>&1 | Select-Object -Last 1
node tools\pixel-test.mjs 2>&1 | Select-Object -Last 2
