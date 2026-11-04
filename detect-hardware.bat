@echo off
REM Corre la deteccion de hardware en segundo plano (sin ventana)
PowerShell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0detect-hardware.ps1"
