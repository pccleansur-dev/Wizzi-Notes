param(
  [int]$Port = 9010,
  [string]$Device = 'cuda'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $projectRoot 'tools\nemo-speech\bin\nemo-speech.exe'
$model = Join-Path $projectRoot 'models\nemotron\nemotron-3.5-asr-streaming-0.6b.q8_0.gguf'

if (-not (Test-Path -LiteralPath $runtime)) {
  throw 'Falta tools\nemo-speech. Instalá NeMo-Speech.cpp siguiendo README.md.'
}
if (-not (Test-Path -LiteralPath $model)) {
  throw 'Falta el modelo Nemotron 3.5 Q8. Descargalo siguiendo README.md.'
}

Write-Host "Nemotron 3.5 ASR: http://127.0.0.1:$Port"
& $runtime serve `
  --host 127.0.0.1 `
  --port $Port `
  --asr-model $model `
  --device $Device `
  --no-ui

exit $LASTEXITCODE
