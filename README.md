# LipSync Video Generator

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/sterling9879/Automation-Ugc/blob/main/LipSync_Video_Generator.ipynb)

Sistema completo para geracao automatizada de videos profissionais com sincronizacao labial (lip-sync) usando inteligencia artificial.

## Novidade: Versao Desktop

Agora com **aplicativo desktop nativo** usando Eel - execute sem navegador, sem localhost visivel!

```bash
python app_main.py
```

## Visao Geral

Este sistema transforma roteiros de texto em videos completos com apresentadores virtuais usando:

- **Gemini 2.5 Flash Lite**: Formatacao e otimizacao automatica de texto
- **ElevenLabs/MiniMax**: Sintese de voz de alta qualidade em multiplos idiomas
- **WaveSpeed Wan 2.2**: Geracao de video com lip-sync realista
- **FFmpeg**: Concatenacao e edicao de videos
- **Eel**: Interface desktop nativa (novo!)

## Funcionalidades

- **Geracao de Video Unico**: Converta um roteiro em video com apresentador virtual
- **Multiplos Roteiros**: Processe varios roteiros de uma vez com preview
- **Gestao de Avatares**: Salve e reutilize imagens de apresentadores
- **Projetos**: Organize seus videos em projetos com tags
- **Historico**: Acesse facilmente todos os videos gerados
- **Interface Desktop**: Aplicativo nativo sem necessidade de navegador

## Formas de Uso

### 1. Aplicativo Desktop (Recomendado)

Janela nativa, sem console, sem localhost visivel.

```bash
# Instalar dependencias
pip install -r requirements.txt

# Executar desktop
python app_main.py
```

### 2. Google Colab

Zero instalacao, roda no navegador.

**[Abrir no Colab](https://colab.research.google.com/github/sterling9879/Automation-Ugc/blob/main/LipSync_Video_Generator.ipynb)**

### 3. Servidor Web (Flask/Gradio)

Para desenvolvimento ou servidor compartilhado.

```bash
python web_server.py
```

## Pre-requisitos

### Software Necessario

1. **Python 3.9+** - https://python.org/downloads
2. **FFmpeg** - Para processamento de video
   - Windows: https://ffmpeg.org/download.html
   - macOS: `brew install ffmpeg`
   - Ubuntu: `sudo apt-get install ffmpeg`
3. **Google Chrome ou Microsoft Edge** - Para interface desktop

### API Keys Necessarias

| Servico | Funcao | Obter em |
|---------|--------|----------|
| Gemini AI | Formatacao de texto | https://makersuite.google.com/app/apikey |
| ElevenLabs | Sintese de voz | https://elevenlabs.io/api |
| WaveSpeed | Geracao de video | https://wavespeed.ai |
| MiniMax (opcional) | Sintese de voz alternativa | https://api.minimax.chat |

## Instalacao Rapida

```bash
# Clone o repositorio
git clone https://github.com/sterling9879/oficial-1.git
cd oficial-1

# Crie ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou: venv\Scripts\activate  # Windows

# Instale dependencias
pip install -r requirements.txt

# Configure API keys (via interface ou .env)
cp .env.example .env
# Edite .env com suas chaves

# Execute
python app_main.py
```

## Gerar Executavel (.exe)

```bash
# Windows
build.bat

# Linux/Mac
./build.sh
```

Executavel gerado em: `dist/LipSyncVideoGenerator.exe`

## Configuracao

### Via Interface

1. Abra o aplicativo
2. Clique em "Configurar API Keys" no canto superior direito
3. Insira suas chaves de API
4. Salve

### Via Arquivo .env

```env
# Obrigatorios
GEMINI_API_KEY=sua_chave_gemini
ELEVENLABS_API_KEY=sua_chave_elevenlabs
WAVESPEED_API_KEY=sua_chave_wavespeed

# Opcional
MINIMAX_API_KEY=sua_chave_minimax
AUDIO_PROVIDER=elevenlabs
BATCH_SIZE=3
MAX_CONCURRENT_REQUESTS=10
DEFAULT_RESOLUTION=480p
```

## Estrutura do Projeto

```
oficial-1/
├── app_main.py           # Aplicativo desktop (Eel)
├── web_server.py         # Servidor web Flask
├── config.py             # Configuracoes
├── job_manager.py        # Orquestrador de jobs
├── text_processor.py     # Processamento com Gemini
├── audio_generator.py    # Geracao de audio
├── video_generator.py    # Geracao de video
├── video_concatenator.py # Concatenacao FFmpeg
├── database.py           # Armazenamento JSON
├── utils.py              # Funcoes auxiliares
├── static/               # Frontend
│   ├── index.html
│   ├── css/
│   └── js/
│       ├── app.js        # Web version
│       └── app_eel.js    # Desktop version
├── build.spec            # PyInstaller config
├── build.bat             # Build Windows
├── build.sh              # Build Linux/Mac
├── requirements.txt      # Dependencias
└── .env.example          # Template config
```

## Fluxo de Processamento

```
1. Texto de entrada
       |
2. Gemini AI formata texto
       |
3. ElevenLabs/MiniMax gera audio
       |
4. WaveSpeed gera video lip-sync
       |
5. FFmpeg concatena videos
       |
6. Video MP4 pronto!
```

## Custos Estimados

| Servico | Custo Aproximado |
|---------|------------------|
| Gemini AI | ~$0.10 / 1M caracteres |
| ElevenLabs | ~$0.30 / 1K caracteres |
| WaveSpeed | ~$0.20 / video |

**Video tipico de 2 minutos**: ~$0.35 - $0.50

## Troubleshooting

### "FFmpeg nao encontrado"
Instale FFmpeg e adicione ao PATH do sistema.

### "Nenhuma voz disponivel"
Verifique sua API key do ElevenLabs/MiniMax.

### Aplicativo nao abre janela
Instale Google Chrome ou Microsoft Edge.

### Build falha
Execute de um ambiente virtual ativado com todas as dependencias.

## Suporte

Para bugs e sugestoes:
https://github.com/sterling9879/oficial-1/issues

---

**LipSync Video Generator** - Transforme texto em videos com apresentador virtual usando IA
