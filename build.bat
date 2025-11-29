@echo off
REM ============================================================================
REM LipSync Video Generator - Windows Build Script
REM Creates standalone .exe desktop application
REM ============================================================================

echo.
echo ============================================================================
echo   LipSync Video Generator - Build Script (Windows)
echo ============================================================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python nao encontrado. Instale Python 3.9+ primeiro.
    pause
    exit /b 1
)

echo [1/5] Verificando Python...
python --version

REM Create virtual environment if not exists
if not exist "venv" (
    echo.
    echo [2/5] Criando ambiente virtual...
    python -m venv venv
)

REM Activate virtual environment
echo.
echo [3/5] Ativando ambiente virtual...
call venv\Scripts\activate.bat

REM Install dependencies
echo.
echo [4/5] Instalando dependencias...
pip install --upgrade pip
pip install -r requirements.txt

REM Create necessary directories
if not exist "temp" mkdir temp
if not exist "data" mkdir data

REM Build executable
echo.
echo [5/5] Compilando aplicativo desktop...
echo       Isso pode demorar alguns minutos...
echo.

pyinstaller build.spec --clean --noconfirm

if errorlevel 1 (
    echo.
    echo [ERROR] Falha na compilacao!
    echo         Verifique os erros acima.
    pause
    exit /b 1
)

echo.
echo ============================================================================
echo   BUILD CONCLUIDO COM SUCESSO!
echo ============================================================================
echo.
echo   Executavel gerado em:
echo   dist\LipSyncVideoGenerator.exe
echo.
echo   Para executar:
echo   1. Va ate a pasta dist
echo   2. Copie .env.example para .env
echo   3. Configure suas API keys no arquivo .env
echo   4. Execute LipSyncVideoGenerator.exe
echo.
echo   IMPORTANTE: FFmpeg deve estar instalado no sistema!
echo   Download: https://ffmpeg.org/download.html
echo.
echo ============================================================================

pause
