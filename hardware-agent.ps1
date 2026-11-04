# hardware-agent.ps1
# Agente HTTP local que detecta hardware del host y lo expone al container Docker
# Escucha en http://localhost:3099/
# Correr una vez; agregar al inicio de Windows para que sea automático.

$port      = 3099
$listener  = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")

function Get-VramMb {
    # Win32_VideoController.AdapterRAM es 32-bit (tope 4 GB).
    # Leemos desde el registro que si tiene el valor correcto en 64 bits.
    $regBase = "HKLM:\SYSTEM\ControlSet001\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"
    $vramBytes = $null
    try {
        Get-ChildItem $regBase -ErrorAction SilentlyContinue | ForEach-Object {
            $props = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
            # qwMemorySize es QWORD (64-bit) — valor real de VRAM
            if ($props.'HardwareInformation.qwMemorySize' -gt 0) {
                $vramBytes = $props.'HardwareInformation.qwMemorySize'
            }
        }
    } catch {}

    if ($vramBytes -and $vramBytes -gt 0) {
        return [math]::Round($vramBytes / 1MB)
    }

    # Fallback: AdapterRAM (solo util hasta 4 GB)
    $gpuObj = Get-WmiObject Win32_VideoController |
              Where-Object { $_.Name -notlike "*Basic*" -and $_.Name -notlike "*Remote*" -and $_.Name -notlike "*Virtual*" } |
              Select-Object -First 1
    if ($gpuObj -and $gpuObj.AdapterRAM -gt 0) {
        return [math]::Round($gpuObj.AdapterRAM / 1MB)
    }
    return $null
}

function Detect-Hardware {
    $cpu = (Get-WmiObject Win32_Processor | Select-Object -First 1).Name.Trim()

    $gpuObj = Get-WmiObject Win32_VideoController |
              Where-Object { $_.Name -notlike "*Basic*" -and $_.Name -notlike "*Remote*" -and $_.Name -notlike "*Virtual*" } |
              Select-Object -First 1
    $gpu    = if ($gpuObj) { $gpuObj.Name.Trim() } else { $null }
    $vramMb = Get-VramMb

    $ramMb  = [math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory / 1MB)

    $profile = "cpu"
    if ($vramMb -ge 6500)     { $profile = "3080" }
    elseif ($vramMb -ge 3500) { $profile = "1650" }
    else {
        $cpuLow = $cpu.ToLower()
        if ($cpuLow -match "ryzen ai|ryzen [579] [789]\d{3}|core ultra") { $profile = "npu" }
    }

    return @{
        cpuName    = $cpu
        gpuName    = $gpu
        vramMb     = $vramMb
        ramMb      = $ramMb
        profile    = $profile
        detectedBy = @("WMI/Windows-Agent")
        timestamp  = (Get-Date -Format "o")
    }
}

try {
    $listener.Start()
    Write-Host "[Wizzi Hardware Agent] Escuchando en puerto $port..."

    while ($listener.IsListening) {
        $context  = $listener.GetContext()
        $request  = $context.Request
        $response = $context.Response

        # CORS para Docker
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.ContentType = "application/json; charset=utf-8"

        if ($request.Url.AbsolutePath -eq "/register-startup") {
            try {
                $startupDir = [Environment]::GetFolderPath("Startup")
                $target     = Join-Path $startupDir "wizzi-hardware-agent.bat"
                $source     = Join-Path $scriptDir "start-hardware-agent.bat"
                Copy-Item -Path $source -Destination $target -Force
                $json  = '{"ok":true,"path":"' + $target.Replace('\','\\') + '"}'
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $err   = '{"ok":false,"error":"' + $_.Exception.Message.Replace('"','\"') + '"}'
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($err)
                $response.StatusCode = 500
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } elseif ($request.Url.AbsolutePath -eq "/detect") {
            try {
                $hw   = Detect-Hardware
                $json = $hw | ConvertTo-Json -Depth 3 -Compress

                # Guardar en config/hardware.json del proyecto
                $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
                $configDir = Join-Path $scriptDir "config"
                if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir | Out-Null }
                $json | Set-Content -Path (Join-Path $configDir "hardware.json") -Encoding UTF8

                $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.StatusCode = 200
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $err   = '{"error":"' + $_.Exception.Message + '"}'
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($err)
                $response.StatusCode = 500
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } elseif ($request.Url.AbsolutePath -eq "/ping") {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
        }

        $response.OutputStream.Close()
    }
} finally {
    $listener.Stop()
}
