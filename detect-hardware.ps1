# detect-hardware.ps1
# Detecta hardware del host Windows y escribe config/hardware.json
# Correr una vez desde la raiz del proyecto: .\detect-hardware.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outFile    = Join-Path $scriptDir "config\hardware.json"

try {
    # CPU
    $cpu = (Get-WmiObject Win32_Processor | Select-Object -First 1).Name.Trim()

    # GPU (excluye el adaptador basico de Microsoft)
    $gpuObj = Get-WmiObject Win32_VideoController |
              Where-Object { $_.Name -notlike "*Basic*" -and $_.Name -notlike "*Remote*" } |
              Select-Object -First 1
    $gpu     = if ($gpuObj) { $gpuObj.Name.Trim() } else { $null }
    $vramMb  = if ($gpuObj -and $gpuObj.AdapterRAM) { [math]::Round($gpuObj.AdapterRAM / 1MB) } else { $null }

    # RAM total
    $ramMb = [math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory / 1MB)

    # Mapear perfil
    $profile = "cpu"
    if ($vramMb -ge 6500)  { $profile = "3080" }
    elseif ($vramMb -ge 3500) { $profile = "1650" }
    else {
        $cpuLower = $cpu.ToLower()
        if ($cpuLower -match "ryzen ai|ryzen [579] [789]\d{3}|core ultra") {
            $profile = "npu"
        }
    }

    $result = @{
        cpuName    = $cpu
        gpuName    = $gpu
        vramMb     = $vramMb
        ramMb      = $ramMb
        profile    = $profile
        detectedBy = @("WMI/Windows")
        timestamp  = (Get-Date -Format "o")
    }

    # Asegurarse que existe el directorio config
    $configDir = Join-Path $scriptDir "config"
    if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir | Out-Null }

    $result | ConvertTo-Json -Depth 3 | Set-Content -Path $outFile -Encoding UTF8
    Write-Host "Hardware detectado y guardado en: $outFile"
    Write-Host "CPU:   $cpu"
    Write-Host "GPU:   $gpu"
    Write-Host "VRAM:  $vramMb MB"
    Write-Host "RAM:   $ramMb MB"
    Write-Host "Perfil: $profile"
}
catch {
    Write-Error "Error detectando hardware: $_"
    exit 1
}
