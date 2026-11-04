param(
  [int]$Port = 9010,
  [string]$Device = 'cuda',
  # auto = IP de Windows en la red de WSL (para que los contenedores de Coolify lleguen); sin WSL cae a 127.0.0.1.
  [string]$BindHost = 'auto'
)

$ErrorActionPreference = 'Stop'
if ($BindHost -eq 'auto') {
  $wsl = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -like 'vEthernet (WSL*' } | Select-Object -First 1
  $BindHost = if ($wsl) { $wsl.IPAddress } else { '127.0.0.1' }
}
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $projectRoot 'tools\nemo-speech\bin\nemo-speech.exe'
$model = Join-Path $projectRoot 'models\nemotron\nemotron-3.5-asr-streaming-0.6b.q8_0.gguf'

if (-not (Test-Path -LiteralPath $runtime)) {
  throw 'Falta tools\nemo-speech. Instalá NeMo-Speech.cpp siguiendo README.md.'
}
if (-not (Test-Path -LiteralPath $model)) {
  throw 'Falta el modelo Nemotron 3.5 Q8. Descargalo siguiendo README.md.'
}

Write-Host "Nemotron 3.5 ASR: http://${BindHost}:$Port"
& $runtime serve `
  --host $BindHost `
  --port $Port `
  --asr-model $model `
  --device $Device `
  --no-ui

exit $LASTEXITCODE
