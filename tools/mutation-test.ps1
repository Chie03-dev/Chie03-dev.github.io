param()
$root = 'd:\Developers\Projects\portfolio'
Set-Location $root
$bak = Join-Path $env:TEMP 'smokebak'
New-Item -ItemType Directory -Force -Path $bak | Out-Null
Copy-Item js\render.js, js\deck.js, js\layers.js $bak -Force

function Restore { Copy-Item $bak\render.js, $bak\deck.js, $bak\layers.js js\ -Force }

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
Mutate '5. travel bleeds into treasure' 'js\deck.js' 'var TRAVEL_LAST = 3;' 'var TRAVEL_LAST = 4;'
Mutate '6. no travel through sky stop' 'js\deck.js' 'var TRAVEL_FIRST = 1;' 'var TRAVEL_FIRST = 0;'
Write-Output ''
Write-Output 'restored - confirming the tree is clean again:'
node tools\smoke.mjs 2>&1 | Select-Object -Last 1
