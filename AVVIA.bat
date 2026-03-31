@echo off
title Ulteria - Gestionale Offerte
echo.
echo  ========================================
echo   Ulteria - Gestionale Offerte v1.0
echo  ========================================
echo.
echo  Avvio server in corso...
echo  Apri nel browser: http://localhost:5000
echo.
echo  Per chiudere: chiudi questa finestra
echo  ========================================
echo.
cd /d "%~dp0"
start http://localhost:5000
py app.py
pause
