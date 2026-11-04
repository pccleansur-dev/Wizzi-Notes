@echo off
REM Registra el agente de hardware para que inicie automaticamente con Windows
REM Correr UNA SOLA VEZ como administrador no es necesario

set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set AGENT=%~dp0start-hardware-agent.bat

REM Copiar el bat al inicio de Windows
copy /Y "%AGENT%" "%STARTUP%\wizzi-hardware-agent.bat" >nul

if %ERRORLEVEL%==0 (
    echo [OK] Agente registrado en el inicio de Windows.
    echo      Se iniciara automaticamente la proxima vez que reinicies.
    echo.
    echo Iniciando ahora...
    start "" /B PowerShell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0hardware-agent.ps1"
    echo [OK] Agente corriendo en segundo plano.
) else (
    echo [ERROR] No se pudo registrar. Intenta correr como Administrador.
)

timeout /t 3 >nul
