#!/bin/bash
# LipSync Video Generator - Build Script para Linux/macOS
# Gera executável multiplataforma

echo ""
echo "============================================================"
echo "  LipSync Video Generator - Build do Executavel"
echo "============================================================"
echo ""

# Verifica Python
if ! command -v python3 &> /dev/null; then
    echo "ERRO: Python3 nao encontrado!"
    echo "Por favor, instale o Python 3.8+"
    exit 1
fi

# Verifica pip
if ! command -v pip3 &> /dev/null; then
    echo "ERRO: pip3 nao encontrado!"
    exit 1
fi

echo "[1/4] Instalando dependencias..."
pip3 install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "ERRO: Falha ao instalar dependencias!"
    exit 1
fi

echo ""
echo "[2/4] Instalando PyInstaller..."
pip3 install pyinstaller
if [ $? -ne 0 ]; then
    echo "ERRO: Falha ao instalar PyInstaller!"
    exit 1
fi

echo ""
echo "[3/4] Criando pastas necessarias..."
mkdir -p data/avatars/thumbnails

echo ""
echo "[4/4] Gerando executavel..."
echo "Isso pode demorar alguns minutos..."
echo ""

pyinstaller --clean lipsync.spec

if [ $? -ne 0 ]; then
    echo ""
    echo "ERRO: Falha ao gerar executavel!"
    exit 1
fi

echo ""
echo "============================================================"
echo "  BUILD CONCLUIDO COM SUCESSO!"
echo "============================================================"
echo ""
echo "O executavel foi gerado em:"
echo "  dist/LipSync Video Generator/"
echo ""
echo "Para executar:"
echo "  cd 'dist/LipSync Video Generator'"
echo "  ./LipSync\ Video\ Generator"
echo ""
echo "IMPORTANTE:"
echo "  - Certifique-se de ter o FFmpeg instalado"
echo "  - Configure suas API keys pela interface web"
echo ""
echo "============================================================"
