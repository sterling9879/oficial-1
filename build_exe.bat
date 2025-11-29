@echo off
chcp 65001 >nul
title LipSync Video Generator - Build

echo.
echo ============================================================
echo   LipSync Video Generator - Build do Executavel Windows
echo ============================================================
echo.

:: Verifica se Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Python nao encontrado!
    echo Por favor, instale o Python 3.8+ e adicione ao PATH.
    echo Download: https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Verifica se pip está instalado
pip --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: pip nao encontrado!
    pause
    exit /b 1
)

echo [1/4] Instalando dependencias...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERRO: Falha ao instalar dependencias!
    pause
    exit /b 1
)

echo.
echo [2/4] Instalando PyInstaller...
pip install pyinstaller
if errorlevel 1 (
    echo ERRO: Falha ao instalar PyInstaller!
    pause
    exit /b 1
)

echo.
echo [3/4] Criando pastas necessarias...
if not exist "data" mkdir data
if not exist "data\avatars" mkdir data\avatars
if not exist "data\avatars\thumbnails" mkdir data\avatars\thumbnails

echo.
echo [4/4] Gerando executavel...
echo Isso pode demorar alguns minutos...
echo.

pyinstaller --clean lipsync.spec

if errorlevel 1 (
    echo.
    echo ERRO: Falha ao gerar executavel!
    echo Verifique os erros acima.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   BUILD CONCLUIDO COM SUCESSO!
echo ============================================================
echo.
echo O executavel foi gerado em:
echo   dist\LipSync Video Generator\
echo.
echo Para executar:
echo   1. Navegue ate a pasta "dist\LipSync Video Generator"
echo   2. Execute "LipSync Video Generator.exe"
echo.
echo IMPORTANTE:
echo   - Certifique-se de ter o FFmpeg instalado no sistema
echo   - Configure suas API keys pela interface web
echo.
echo ============================================================
echo.

:: Abre a pasta do executável
explorer "dist\LipSync Video Generator"

pause
