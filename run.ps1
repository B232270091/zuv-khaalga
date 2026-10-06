param([ValidateSet('dev','build','test','preview','test:browser')][string]$Task = 'dev')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$localNode = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '.tools') -Directory -Filter 'node-*-win-x64' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($localNode) { $env:Path = $localNode.FullName + ';' + $env:Path }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js 22.12+ is required: https://nodejs.org/'
  exit 1
}
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\vite'))) {
  & npm.cmd ci --cache .tools/npm-cache
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& npm.cmd run $Task
exit $LASTEXITCODE
