@echo off
rem Regenera 03-dashboard\data\catalogo_data.js a partir de saida\catalogo_metadados.xlsx e abre o painel.
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" "02-processamento\gerar_catalogo.py"
) else (
  python "02-processamento\gerar_catalogo.py"
)
if errorlevel 1 (
  echo.
  echo Falha ao gerar o catalogo. Verifique se pandas e openpyxl estao instalados.
  pause
  exit /b 1
)
start "" "03-dashboard\index.html"
