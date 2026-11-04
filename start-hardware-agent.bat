@echo off
REM Inicia el agente de hardware en segundo plano (sin ventana)
REM Agregar al inicio de Windows para deteccion automatica
PowerShell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0hardware-agent.ps1"
