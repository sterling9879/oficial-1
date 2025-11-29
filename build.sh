#!/bin/bash
# ============================================================================
# LipSync Video Generator - Linux/Mac Build Script
# Creates standalone desktop application
# ============================================================================

set -e  # Exit on error

echo ""
echo "============================================================================"
echo "  LipSync Video Generator - Build Script (Linux/Mac)"
echo "============================================================================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python3 nao encontrado. Instale Python 3.9+ primeiro."
    exit 1
fi

echo "[1/5] Verificando Python..."
python3 --version

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
    echo ""
    echo "[2/5] Criando ambiente virtual..."
    python3 -m venv venv
fi

# Activate virtual environment
echo ""
echo "[3/5] Ativando ambiente virtual..."
source venv/bin/activate

# Install dependencies
echo ""
echo "[4/5] Instalando dependencias..."
pip install --upgrade pip
pip install -r requirements.txt

# Create necessary directories
mkdir -p temp
mkdir -p data

# Build executable
echo ""
echo "[5/5] Compilando aplicativo desktop..."
echo "      Isso pode demorar alguns minutos..."
echo ""

pyinstaller build.spec --clean --noconfirm

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Falha na compilacao!"
    echo "        Verifique os erros acima."
    exit 1
fi

# Make executable
chmod +x dist/LipSyncVideoGenerator 2>/dev/null || true

echo ""
echo "============================================================================"
echo "  BUILD CONCLUIDO COM SUCESSO!"
echo "============================================================================"
echo ""
echo "  Executavel gerado em:"
echo "  dist/LipSyncVideoGenerator"
echo ""
echo "  Para executar:"
echo "  1. Va ate a pasta dist"
echo "  2. Copie .env.example para .env"
echo "  3. Configure suas API keys no arquivo .env"
echo "  4. Execute ./LipSyncVideoGenerator"
echo ""
echo "  IMPORTANTE: FFmpeg deve estar instalado no sistema!"
echo "  - Ubuntu/Debian: sudo apt-get install ffmpeg"
echo "  - macOS: brew install ffmpeg"
echo ""
echo "============================================================================"
