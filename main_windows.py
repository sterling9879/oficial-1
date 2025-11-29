"""
LipSync Video Generator - Executável Windows
Inicia o servidor Flask e abre o navegador automaticamente
"""
import os
import sys
import webbrowser
import threading
import time
import socket
from pathlib import Path

# Configura o diretório base para o executável
if getattr(sys, 'frozen', False):
    # Rodando como executável
    BASE_DIR = Path(sys.executable).parent
    os.chdir(BASE_DIR)
else:
    # Rodando como script Python
    BASE_DIR = Path(__file__).parent

# Adiciona o diretório ao path
sys.path.insert(0, str(BASE_DIR))

# Configura variáveis de ambiente antes de importar outros módulos
os.environ.setdefault('FLASK_ENV', 'production')

def find_free_port(start_port=5000, max_attempts=100):
    """Encontra uma porta livre começando de start_port"""
    for port in range(start_port, start_port + max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    return start_port

def create_required_directories():
    """Cria diretórios necessários se não existirem"""
    dirs = [
        BASE_DIR / 'temp',
        BASE_DIR / 'temp' / 'uploads',
        BASE_DIR / 'temp' / 'outputs',
        BASE_DIR / 'data',
        BASE_DIR / 'data' / 'avatars',
        BASE_DIR / 'data' / 'avatars' / 'thumbnails',
        BASE_DIR / 'projects',
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)

def create_default_env():
    """Cria arquivo .env padrão se não existir"""
    env_path = BASE_DIR / '.env'
    if not env_path.exists():
        default_env = """# LipSync Video Generator - Configuração
# Preencha suas API keys abaixo ou configure pela interface web

ELEVENLABS_API_KEY=
MINIMAX_API_KEY=
GEMINI_API_KEY=
WAVESPEED_API_KEY=

# Configurações opcionais
AUDIO_PROVIDER=elevenlabs
MAX_CONCURRENT_REQUESTS=10
BATCH_SIZE=3
DEFAULT_RESOLUTION=480p
VIDEO_QUALITY=high
"""
        with open(env_path, 'w', encoding='utf-8') as f:
            f.write(default_env)
        print(f"Arquivo .env criado em: {env_path}")

def open_browser(port):
    """Abre o navegador após um pequeno delay"""
    time.sleep(2)  # Espera o servidor iniciar
    url = f'http://localhost:{port}'
    print(f"\nAbrindo navegador em: {url}")
    webbrowser.open(url)

def check_ffmpeg():
    """Verifica se o FFmpeg está instalado"""
    import subprocess
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        )
        if result.returncode == 0:
            print("FFmpeg encontrado!")
            return True
    except FileNotFoundError:
        pass

    print("\n" + "="*60)
    print("  AVISO: FFmpeg nao encontrado!")
    print("="*60)
    print("\n  O FFmpeg e necessario para concatenar videos.")
    print("  Por favor, instale o FFmpeg e adicione ao PATH do sistema.")
    print("\n  Download: https://ffmpeg.org/download.html")
    print("  Tutorial: https://www.wikihow.com/Install-FFmpeg-on-Windows")
    print("\n" + "="*60)
    return False

def main():
    """Função principal"""
    print("\n" + "="*60)
    print("  LipSync Video Generator")
    print("  Gerador de Videos com Lip-Sync")
    print("="*60)

    # Cria diretórios necessários
    print("\nPreparando ambiente...")
    create_required_directories()
    create_default_env()

    # Verifica FFmpeg
    check_ffmpeg()

    # Encontra porta livre
    port = find_free_port(5000)

    # Carrega o dotenv antes de importar o app
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / '.env')

    # Importa o app Flask (isso carrega todos os módulos)
    print("\nCarregando aplicacao...")

    # Desabilita validação automática durante import
    os.environ['SKIP_CONFIG_VALIDATION'] = '1'

    from web_server import app

    print(f"\nServidor configurado na porta: {port}")
    print(f"Pasta de dados: {BASE_DIR / 'data'}")
    print(f"Pasta temporaria: {BASE_DIR / 'temp'}")

    print("\n" + "="*60)
    print(f"  Acesse: http://localhost:{port}")
    print("  Pressione Ctrl+C para encerrar")
    print("="*60 + "\n")

    # Abre navegador em thread separada
    browser_thread = threading.Thread(target=open_browser, args=(port,), daemon=True)
    browser_thread.start()

    # Inicia servidor Flask
    try:
        # Usa waitress em produção se disponível, senão usa Flask diretamente
        try:
            from waitress import serve
            print("Usando servidor Waitress (producao)...")
            serve(app, host='127.0.0.1', port=port, threads=4)
        except ImportError:
            print("Usando servidor Flask de desenvolvimento...")
            app.run(host='127.0.0.1', port=port, debug=False, threaded=True)
    except KeyboardInterrupt:
        print("\n\nServidor encerrado pelo usuario.")
    except Exception as e:
        print(f"\nErro ao iniciar servidor: {e}")
        input("\nPressione Enter para sair...")

if __name__ == '__main__':
    main()
