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
           'place.js','sprites.js','main.js')
Copy-Item ($files | ForEach-Object { Join-Path 'js' $_ }) $bak -Force
Copy-Item css\layout.css, css\chambers.css $bak -Force
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
  Copy-Item $bak\layout.css, $bak\chambers.css css\ -Force
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
Mutate '15. flowers reduced to three colours' 'js\sprites.js' "  { petal: '#5ee0ff', petalDim: '#1f92c4', core: '#eafcff' },  /* cyan    */" ''
Mutate '16. no trees on the surface layer' 'js\sprites.js' "SET.canopies = [bakeCanopy(21, 19, PAL.leaf, r), bakeCanopy(26, 23, PAL.leaf, r)];" "SET.canopies = [];"
Mutate '17. no crystal in the caves' 'js\sprites.js' "SET.crystals = [bakeShard(15, PAL.ice, r, false), bakeShard(21, PAL.ice, r, false)];" "SET.crystals = [];"
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
Write-Output ''
Write-Output 'restored - confirming the tree is clean again:'
node tools\smoke.mjs 2>&1 | Select-Object -Last 1
node tools\pixel-test.mjs 2>&1 | Select-Object -Last 2
