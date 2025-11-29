#!/usr/bin/env python3
"""
LipSync Video Generator - Desktop Application
Aplicativo desktop profissional usando Eel (Chrome/Edge/Webview)
"""
import os
import sys
import json
import base64
import threading
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

# Configurar paths para PyInstaller
def get_base_path():
    """Retorna o diretório base (funciona em dev e no .exe)"""
    if getattr(sys, 'frozen', False):
        # Executando como .exe (PyInstaller)
        return Path(sys._MEIPASS)
    return Path(__file__).parent.resolve()

def get_app_path():
    """Retorna o diretório do app (onde salvar dados)"""
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).parent.resolve()

# Configura variáveis de ambiente antes de importar outros módulos
BASE_PATH = get_base_path()
APP_PATH = get_app_path()

# Carrega .env do diretório do app
from dotenv import load_dotenv
env_path = APP_PATH / '.env'
if env_path.exists():
    load_dotenv(env_path)
else:
    # Tenta carregar do diretório base
    load_dotenv()

# Agora importa Eel e outros módulos
import eel
from werkzeug.utils import secure_filename

# ============================================================================
# CONFIGURAÇÃO DO EEL
# ============================================================================

# Inicializa Eel com a pasta static
STATIC_PATH = BASE_PATH / 'static'
eel.init(str(STATIC_PATH))

# Diretórios de trabalho
UPLOAD_FOLDER = APP_PATH / 'temp' / 'uploads'
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

OUTPUT_FOLDER = APP_PATH / 'temp' / 'outputs'
OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)

DATA_FOLDER = APP_PATH / 'data'
DATA_FOLDER.mkdir(parents=True, exist_ok=True)

# ============================================================================
# IMPORTS DOS MÓDULOS DO PROJETO (lazy loading para evitar erros de config)
# ============================================================================

_config = None
_job_manager = None
_audio_generator = None
_db = None

def get_config():
    """Lazy load do Config"""
    global _config
    if _config is None:
        # Patch temporário para evitar validação no import
        os.environ.setdefault('BYPASS_VALIDATION', 'true')
        from config import Config
        _config = Config
    return _config

def get_job_manager(provider='elevenlabs'):
    """Lazy load do JobManager"""
    from job_manager import JobManager
    return JobManager(audio_provider=provider)

def get_audio_generator(provider='elevenlabs'):
    """Lazy load do AudioGenerator"""
    from audio_generator import AudioGenerator
    return AudioGenerator(provider=provider)

def get_db():
    """Lazy load do Database"""
    global _db
    if _db is None:
        from database import Database
        _db = Database(data_dir=str(DATA_FOLDER))
    return _db

def get_utils():
    """Lazy load dos utils"""
    from utils import split_into_paragraphs, create_batches
    return split_into_paragraphs, create_batches

# ============================================================================
# API - CONFIGURAÇÃO
# ============================================================================

@eel.expose
def get_api_keys_status():
    """Retorna status de quais API keys estão configuradas"""
    try:
        return {
            'success': True,
            'keys': {
                'elevenlabs': bool(os.getenv('ELEVENLABS_API_KEY')),
                'minimax': bool(os.getenv('MINIMAX_API_KEY')),
                'gemini': bool(os.getenv('GEMINI_API_KEY')),
                'wavespeed': bool(os.getenv('WAVESPEED_API_KEY'))
            }
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def save_api_keys(data):
    """Salva API keys no arquivo .env"""
    try:
        env_path = APP_PATH / '.env'
        env_content = {}

        # Lê .env atual
        if env_path.exists():
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env_content[key.strip()] = value.strip()

        # Atualiza com novos valores
        if data.get('elevenlabs_api_key'):
            env_content['ELEVENLABS_API_KEY'] = data['elevenlabs_api_key']
        if data.get('minimax_api_key'):
            env_content['MINIMAX_API_KEY'] = data['minimax_api_key']
        if data.get('gemini_api_key'):
            env_content['GEMINI_API_KEY'] = data['gemini_api_key']
        if data.get('wavespeed_api_key'):
            env_content['WAVESPEED_API_KEY'] = data['wavespeed_api_key']

        # Salva .env
        with open(env_path, 'w', encoding='utf-8') as f:
            for key, value in env_content.items():
                f.write(f"{key}={value}\n")

        # Recarrega variáveis de ambiente
        load_dotenv(env_path, override=True)

        return {
            'success': True,
            'message': 'API keys salvas com sucesso!'
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# API - VOZES
# ============================================================================

@eel.expose
def get_voices(provider):
    """Retorna lista de vozes disponíveis do provedor"""
    try:
        if provider not in ['elevenlabs', 'minimax']:
            return {'success': False, 'error': 'Provedor inválido'}

        audio_gen = get_audio_generator(provider=provider)
        voices = audio_gen.get_available_voices()

        if voices and len(voices) > 0:
            voice_list = [voice['name'] for voice in voices]
            return {
                'success': True,
                'voices': voice_list
            }
        else:
            return {
                'success': False,
                'error': f'Nenhuma voz disponível. Verifique a API key do {provider}'
            }
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# API - ESTIMATIVA
# ============================================================================

@eel.expose
def estimate_job(text):
    """Calcula estimativa de custo e tempo"""
    try:
        if not text or not text.strip():
            return {'success': False, 'error': 'Texto não fornecido'}

        job_mgr = get_job_manager()
        estimate = job_mgr.get_job_estimate(text)

        return {
            'success': True,
            'estimate': estimate
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# API - PREVIEW
# ============================================================================

@eel.expose
def generate_preview(scripts_text):
    """Gera preview dos roteiros com batches"""
    try:
        if not scripts_text or not scripts_text.strip():
            return {'success': False, 'error': 'Texto não fornecido'}

        split_into_paragraphs, create_batches = get_utils()
        Config = get_config()

        # Separa roteiros por "---"
        raw_scripts = [s.strip() for s in scripts_text.split('---') if s.strip()]

        if not raw_scripts:
            return {'success': False, 'error': 'Nenhum roteiro encontrado'}

        scripts_data = []

        for idx, script in enumerate(raw_scripts, 1):
            paragraphs = split_into_paragraphs(script)
            batches = create_batches(paragraphs, Config.BATCH_SIZE)

            script_data = {
                "id": idx,
                "text": script,
                "paragraphs": paragraphs,
                "batches": [
                    {
                        "batch_number": b_idx + 1,
                        "text": "\n\n".join(batch),
                        "char_count": sum(len(p) for p in batch),
                        "image_index": 0
                    }
                    for b_idx, batch in enumerate(batches)
                ],
                "total_chars": len(script),
                "total_batches": len(batches)
            }

            scripts_data.append(script_data)

        total_batches = sum(s["total_batches"] for s in scripts_data)
        total_chars = sum(s["total_chars"] for s in scripts_data)

        return {
            'success': True,
            'scripts': scripts_data,
            'summary': {
                'total_scripts': len(scripts_data),
                'total_batches': total_batches,
                'total_chars': total_chars
            }
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# API - UPLOAD DE IMAGENS
# ============================================================================

@eel.expose
def upload_images_base64(images_data):
    """
    Recebe imagens em base64 e salva em disco
    images_data: List[{name: str, data: str (base64)}]
    """
    try:
        if not images_data:
            return {'success': False, 'error': 'Nenhuma imagem enviada'}

        uploaded_paths = []

        for img in images_data:
            filename = secure_filename(img['name'])
            # Remove prefixo data:image/...;base64,
            base64_data = img['data']
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]

            image_bytes = base64.b64decode(base64_data)
            filepath = UPLOAD_FOLDER / filename

            with open(filepath, 'wb') as f:
                f.write(image_bytes)

            uploaded_paths.append(str(filepath))

        return {
            'success': True,
            'paths': uploaded_paths,
            'count': len(uploaded_paths)
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# API - GERAÇÃO DE VÍDEOS
# ============================================================================

@eel.expose
def generate_single_video(data):
    """Gera um vídeo único"""
    try:
        text = data.get('text', '')
        provider = data.get('provider', 'elevenlabs')
        voice_name = data.get('voice_name', '')
        model_id = data.get('model_id', 'eleven_multilingual_v2')
        image_paths = data.get('image_paths', [])
        max_workers = data.get('max_workers', 3)

        # Validação
        if not text or not text.strip():
            return {'success': False, 'error': 'Texto não fornecido'}

        if not voice_name:
            return {'success': False, 'error': 'Voz não selecionada'}

        if not image_paths or len(image_paths) == 0:
            return {'success': False, 'error': 'Nenhuma imagem fornecida'}

        # Cria job manager
        job_mgr = get_job_manager(audio_provider=provider)

        # Cria job
        job, error = job_mgr.create_job(
            input_text=text,
            voice_name=voice_name,
            image_paths=image_paths,
            model_id=model_id
        )

        if error:
            return {'success': False, 'error': error}

        # Cria job no database
        db = get_db()
        db_job = db.create_job({
            'type': 'single_video',
            'metadata': {'text_preview': text[:100]}
        })
        db_job_id = db_job['id']

        def progress_callback(message, percent):
            """Envia progresso para o frontend"""
            eel.updateProgress(message, percent)

        try:
            # Processa job
            final_video = job_mgr.process_job(
                job=job,
                progress_callback=progress_callback,
                max_workers_video=max_workers
            )

            # Move para pasta de outputs
            output_name = f"video_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
            output_path = OUTPUT_FOLDER / output_name

            import shutil
            shutil.copy2(str(final_video), str(output_path))

            # Update job as completed
            db.update_job(db_job_id, {
                'status': 'completed',
                'video_path': str(output_path)
            })

            duration = (job.completed_at - job.created_at).total_seconds()

            return {
                'success': True,
                'video_path': str(output_path),
                'job_id': job.job_id,
                'duration': duration
            }
        except Exception as process_error:
            db.update_job(db_job_id, {'status': 'failed'})
            raise process_error

    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def generate_batch_videos(data):
    """Gera múltiplos vídeos em lote"""
    try:
        scripts = data.get('scripts', [])
        provider = data.get('provider', 'elevenlabs')
        model_id = data.get('model_id', 'eleven_multilingual_v2')
        image_paths = data.get('image_paths', [])
        max_workers = data.get('max_workers', 3)
        voice_selections = data.get('voice_selections', [])
        batch_image_mode = data.get('batch_image_mode', 'fixed')
        batch_images = data.get('batch_images', {})

        if not scripts:
            return {'success': False, 'error': 'Nenhum roteiro fornecido'}

        if not image_paths:
            return {'success': False, 'error': 'Nenhuma imagem fornecida'}

        job_mgr = get_job_manager(audio_provider=provider)
        db = get_db()

        results = []
        videos_gerados = []

        # Create database job for batch
        batch_job = db.create_job({
            'type': 'batch_videos',
            'metadata': {'num_scripts': len(scripts)}
        })
        batch_job_id = batch_job['id']

        for idx, script_data in enumerate(scripts):
            try:
                script_text = script_data.get('text', '')
                script_id = script_data.get('id')
                voice_name = voice_selections[idx] if idx < len(voice_selections) else voice_selections[0]

                # Determine image paths for this script based on mode
                if batch_image_mode == 'individual':
                    script_image_paths = []
                    batches = script_data.get('batches', [])

                    for batch in batches:
                        batch_number = batch.get('batch_number')
                        batch_key = f"{script_id}_{batch_number}"

                        if batch_key in batch_images:
                            batch_image_path = batch_images[batch_key]
                            if batch_image_path not in script_image_paths:
                                script_image_paths.append(batch_image_path)

                    if not script_image_paths:
                        script_image_paths = image_paths
                else:
                    script_image_paths = image_paths

                # Cria job
                job, error = job_mgr.create_job(
                    input_text=script_text,
                    voice_name=voice_name,
                    image_paths=script_image_paths,
                    model_id=model_id
                )

                if error:
                    results.append({
                        'script_id': script_id,
                        'success': False,
                        'error': error
                    })
                    continue

                def progress_callback(message, percent):
                    eel.updateProgress(f"Roteiro {script_id}: {message}", percent)

                # Processa job
                final_video = job_mgr.process_job(
                    job=job,
                    progress_callback=progress_callback,
                    max_workers_video=max_workers
                )

                # Move para pasta de outputs
                output_name = f"video_batch_{script_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
                output_path = OUTPUT_FOLDER / output_name

                import shutil
                shutil.copy2(str(final_video), str(output_path))

                duration = (job.completed_at - job.created_at).total_seconds()
                videos_gerados.append(str(output_path))

                results.append({
                    'script_id': script_id,
                    'success': True,
                    'video_path': str(output_path),
                    'duration': duration
                })

            except Exception as e:
                results.append({
                    'script_id': script_data.get('id'),
                    'success': False,
                    'error': str(e)
                })

        # Update batch job
        if videos_gerados:
            db.update_job(batch_job_id, {
                'status': 'completed',
                'video_path': videos_gerados[0] if len(videos_gerados) == 1 else f'{len(videos_gerados)} videos'
            })
        else:
            db.update_job(batch_job_id, {'status': 'failed'})

        return {
            'success': True,
            'results': results,
            'videos_count': len(videos_gerados),
            'total_scripts': len(scripts)
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# API - DOWNLOAD/ARQUIVO DE VÍDEO
# ============================================================================

@eel.expose
def get_video_base64(video_path):
    """Retorna vídeo em base64 para reprodução no frontend"""
    try:
        path = Path(video_path)
        if not path.exists():
            return {'success': False, 'error': 'Vídeo não encontrado'}

        with open(path, 'rb') as f:
            video_data = base64.b64encode(f.read()).decode('utf-8')

        return {
            'success': True,
            'data': f'data:video/mp4;base64,{video_data}',
            'filename': path.name
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_video_history():
    """Lista vídeos do histórico"""
    try:
        videos = []

        if OUTPUT_FOLDER.exists():
            for video_file in OUTPUT_FOLDER.glob('*.mp4'):
                stat = video_file.stat()
                videos.append({
                    'name': video_file.name,
                    'path': str(video_file),
                    'size': stat.st_size,
                    'created_at': stat.st_mtime
                })

        # Sort by creation time (newest first)
        videos.sort(key=lambda x: x['created_at'], reverse=True)

        return {'success': True, 'videos': videos}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def open_video_folder():
    """Abre a pasta de vídeos no explorador de arquivos"""
    try:
        import subprocess
        import platform

        folder = str(OUTPUT_FOLDER)

        if platform.system() == 'Windows':
            os.startfile(folder)
        elif platform.system() == 'Darwin':  # macOS
            subprocess.run(['open', folder])
        else:  # Linux
            subprocess.run(['xdg-open', folder])

        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def save_video_to_location(video_path, save_path):
    """Salva vídeo em local escolhido pelo usuário"""
    try:
        import shutil
        shutil.copy2(video_path, save_path)
        return {'success': True, 'path': save_path}
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# API - PROJETOS
# ============================================================================

@eel.expose
def get_projects(tag_filter=None):
    """Lista todos os projetos"""
    try:
        db = get_db()
        projects = db.get_projects(tag_filter=tag_filter)
        return {'success': True, 'projects': projects}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def create_project(name, description='', tags=None):
    """Cria um novo projeto"""
    try:
        if not name:
            return {'success': False, 'error': 'Nome do projeto é obrigatório'}

        db = get_db()
        project = db.create_project(name, description, tags or [])
        return {'success': True, 'project': project}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_project(project_id):
    """Obtém detalhes de um projeto"""
    try:
        db = get_db()
        project = db.get_project(project_id)

        if not project:
            return {'success': False, 'error': 'Projeto não encontrado'}

        return {'success': True, 'project': project}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def update_project(project_id, data):
    """Atualiza um projeto"""
    try:
        db = get_db()
        project = db.update_project(project_id, data)

        if not project:
            return {'success': False, 'error': 'Projeto não encontrado'}

        return {'success': True, 'project': project}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def delete_project(project_id):
    """Deleta um projeto"""
    try:
        db = get_db()
        db.delete_project(project_id)
        return {'success': True, 'message': 'Projeto deletado com sucesso'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def add_video_to_project(project_id, video_data):
    """Adiciona vídeo a um projeto"""
    try:
        db = get_db()
        success = db.add_video_to_project(project_id, video_data)

        if not success:
            return {'success': False, 'error': 'Projeto não encontrado'}

        return {'success': True, 'message': 'Vídeo adicionado ao projeto'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# API - AVATARS
# ============================================================================

@eel.expose
def get_avatars():
    """Lista todos os avatares"""
    try:
        db = get_db()
        avatars = db.get_avatars()
        return {'success': True, 'avatars': avatars}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def create_avatar(name, image_base64):
    """Cria um novo avatar a partir de imagem base64"""
    try:
        db = get_db()

        # Decodifica imagem
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]

        image_bytes = base64.b64decode(image_base64)

        # Salva imagem
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{secure_filename(name)}.png"

        avatar_path = db.avatars_dir / filename
        with open(avatar_path, 'wb') as f:
            f.write(image_bytes)

        # Thumbnail (usa mesma imagem)
        thumbnail_path = db.avatars_dir / "thumbnails" / filename
        with open(thumbnail_path, 'wb') as f:
            f.write(image_bytes)

        # Salva no banco
        avatar = db.create_avatar(name, str(avatar_path), str(thumbnail_path))

        return {'success': True, 'avatar': avatar}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_avatar_image_base64(avatar_id):
    """Retorna imagem do avatar em base64"""
    try:
        db = get_db()
        avatar = db.get_avatar(avatar_id)

        if not avatar:
            return {'success': False, 'error': 'Avatar não encontrado'}

        image_path = Path(avatar['image_path'])

        if not image_path.exists():
            return {'success': False, 'error': 'Imagem não encontrada'}

        with open(image_path, 'rb') as f:
            image_data = base64.b64encode(f.read()).decode('utf-8')

        # Detecta tipo
        suffix = image_path.suffix.lower()
        mime_type = 'image/png' if suffix == '.png' else 'image/jpeg'

        return {
            'success': True,
            'data': f'data:{mime_type};base64,{image_data}'
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def delete_avatar(avatar_id):
    """Deleta um avatar"""
    try:
        db = get_db()
        db.delete_avatar(avatar_id)
        return {'success': True, 'message': 'Avatar deletado com sucesso'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# API - JOBS
# ============================================================================

@eel.expose
def get_jobs(status=None, limit=50):
    """Lista jobs"""
    try:
        db = get_db()
        jobs = db.get_jobs(status=status, limit=limit)
        return {'success': True, 'jobs': jobs}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def get_job_status(job_id):
    """Obtém status de um job"""
    try:
        db = get_db()
        job = db.get_job(job_id)

        if not job:
            return {'success': False, 'error': 'Job não encontrado'}

        return {'success': True, 'job': job}
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# API - TAGS
# ============================================================================

@eel.expose
def get_tags():
    """Lista todas as tags"""
    try:
        db = get_db()
        tags = db.get_tags()
        return {'success': True, 'tags': tags}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def create_tag(name, color='#667eea'):
    """Cria uma nova tag"""
    try:
        if not name:
            return {'success': False, 'error': 'Nome da tag é obrigatório'}

        db = get_db()
        tag = db.create_tag(name, color)
        return {'success': True, 'tag': tag}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@eel.expose
def delete_tag(tag_id):
    """Deleta uma tag"""
    try:
        db = get_db()
        db.delete_tag(tag_id)
        return {'success': True, 'message': 'Tag deletada com sucesso'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# API - UTILIDADES
# ============================================================================

@eel.expose
def get_app_info():
    """Retorna informações do aplicativo"""
    return {
        'name': 'LipSync Video Generator',
        'version': '2.0.0',
        'mode': 'desktop',
        'base_path': str(BASE_PATH),
        'app_path': str(APP_PATH),
        'output_folder': str(OUTPUT_FOLDER)
    }

@eel.expose
def check_ffmpeg():
    """Verifica se FFmpeg está instalado"""
    try:
        import subprocess
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        return {
            'success': True,
            'installed': result.returncode == 0,
            'version': result.stdout.split('\n')[0] if result.returncode == 0 else None
        }
    except FileNotFoundError:
        return {'success': True, 'installed': False, 'error': 'FFmpeg não encontrado'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ============================================================================
# CALLBACKS DE CLOSE
# ============================================================================

def on_close(page, sockets):
    """Callback quando a janela é fechada"""
    print("Aplicativo encerrado pelo usuário")
    sys.exit(0)

# ============================================================================
# MAIN - INICIALIZAÇÃO
# ============================================================================

def main():
    """Função principal - inicia o aplicativo desktop"""
    print("\n" + "=" * 60)
    print("  LipSync Video Generator - Desktop Edition")
    print("=" * 60)
    print(f"\n  Base Path: {BASE_PATH}")
    print(f"  App Path: {APP_PATH}")
    print(f"  Output Folder: {OUTPUT_FOLDER}")
    print("\n" + "=" * 60 + "\n")

    # Verifica se Chrome/Edge está disponível
    try:
        # Tenta iniciar com Chrome App Mode (melhor experiência)
        eel.start(
            'index.html',
            mode='chrome-app',      # Janela sem barra de endereço
            size=(1400, 900),       # Tamanho da janela
            position=(100, 50),     # Posição inicial
            port=0,                 # Porta aleatória (evita conflitos)
            close_callback=on_close,
            cmdline_args=[
                '--disable-extensions',
                '--disable-gpu',
                '--no-first-run'
            ]
        )
    except EnvironmentError:
        # Fallback para Edge no Windows
        try:
            eel.start(
                'index.html',
                mode='edge',
                size=(1400, 900),
                position=(100, 50),
                port=0,
                close_callback=on_close
            )
        except EnvironmentError:
            # Último fallback - abre no navegador padrão
            print("Chrome/Edge não encontrado. Abrindo no navegador padrão...")
            eel.start(
                'index.html',
                mode=None,  # Usa navegador padrão
                size=(1400, 900),
                port=8080,
                close_callback=on_close
            )

if __name__ == '__main__':
    main()
