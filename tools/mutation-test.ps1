param()
$root = 'd:\Developers\Projects\portfolio'
Set-Location $root
$bak = Join-Path $env:TEMP 'smokebak'
New-Item -ItemType Directory -Force -Path $bak | Out-Null
Copy-Item js\render.js, js\deck.js, js\layers.js, js\biomes.js, js\sprites.js $bak -Force
Copy-Item css\layout.css, css\chambers.css $bak -Force

function Restore {
  Copy-Item $bak\render.js, $bak\deck.js, $bak\layers.js, $bak\biomes.js, $bak\sprites.js js\ -Force
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
Mutate '19. blit a sprite with a zero destination' 'js\biomes.js' 'var k = Math.max(1, Math.min(2, Math.floor(room / spr.width) || 1));' 'var k = 0;'
Write-Output ''
Write-Output 'restored - confirming the tree is clean again:'
node tools\smoke.mjs 2>&1 | Select-Object -Last 1
