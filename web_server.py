"""
Servidor Web Flask para Geração de Vídeos com Lip-Sync
Interface web moderna com configuração de API keys integrada
"""
import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import logging

from config import Config
from job_manager import JobManager
from audio_generator import AudioGenerator  
from utils import get_logger, split_into_paragraphs, create_batches
from database import db

# Configuração de logging
logger = get_logger(__name__)

# Inicialização do Flask
app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# Configurações
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
UPLOAD_FOLDER = Path('./temp/uploads')
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

# ============================================================================
# ROTAS ESTÁTICAS
# ============================================================================

@app.route('/')
def index():
    """Serve a página principal"""
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    """Serve arquivos estáticos"""
    return send_from_directory('static', path)

# ============================================================================
# API - CONFIGURAÇÃO
# ============================================================================

@app.route('/api/config/keys', methods=['GET'])
def get_api_keys_status():
    """Retorna status de quais API keys estão configuradas (com valores mascarados)"""
    try:
        def mask_key(key):
            """Mascara a API key mostrando apenas primeiros e últimos caracteres"""
            if not key:
                return None
            if len(key) <= 8:
                return '*' * len(key)
            return key[:4] + '*' * (len(key) - 8) + key[-4:]

        return jsonify({
            'success': True,
            'keys': {
                'elevenlabs': bool(Config.ELEVENLABS_API_KEY),
                'minimax': bool(Config.MINIMAX_API_KEY),
                'gemini': bool(Config.GEMINI_API_KEY),
                'wavespeed': bool(Config.WAVESPEED_API_KEY)
            },
            'masked_keys': {
                'elevenlabs': mask_key(Config.ELEVENLABS_API_KEY),
                'minimax': mask_key(Config.MINIMAX_API_KEY),
                'gemini': mask_key(Config.GEMINI_API_KEY),
                'wavespeed': mask_key(Config.WAVESPEED_API_KEY)
            }
        })
    except Exception as e:
        logger.error(f"Erro ao verificar API keys: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/config/keys', methods=['POST'])
def save_api_keys():
    """Salva API keys no arquivo .env"""
    try:
        data = request.json
        
        # Validação
        if not data:
            return jsonify({'success': False, 'error': 'Nenhum dado recebido'}), 400
        
        # Lê .env atual ou cria novo
        env_path = Path('.env')
        env_content = {}
        
        if env_path.exists():
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env_content[key.strip()] = value.strip()
        
        # Atualiza com novos valores
        if 'elevenlabs_api_key' in data and data['elevenlabs_api_key']:
            env_content['ELEVENLABS_API_KEY'] = data['elevenlabs_api_key']
        
        if 'minimax_api_key' in data and data['minimax_api_key']:
            env_content['MINIMAX_API_KEY'] = data['minimax_api_key']
        
        if 'gemini_api_key' in data and data['gemini_api_key']:
            env_content['GEMINI_API_KEY'] = data['gemini_api_key']
        
        if 'wavespeed_api_key' in data and data['wavespeed_api_key']:
            env_content['WAVESPEED_API_KEY'] = data['wavespeed_api_key']
        
        # Salva .env
        with open(env_path, 'w', encoding='utf-8') as f:
            for key, value in env_content.items():
                f.write(f"{key}={value}\n")
        
        # Recarrega configuração
        from dotenv import load_dotenv
        load_dotenv(override=True)
        
        # Atualiza Config
        Config.ELEVENLABS_API_KEY = os.getenv('ELEVENLABS_API_KEY')
        Config.MINIMAX_API_KEY = os.getenv('MINIMAX_API_KEY')
        Config.GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
        Config.WAVESPEED_API_KEY = os.getenv('WAVESPEED_API_KEY')
        
        logger.info("API keys atualizadas com sucesso")
        
        return jsonify({
            'success': True,
            'message': 'API keys salvas com sucesso! As configurações foram atualizadas.'
        })
        
    except Exception as e:
        logger.error(f"Erro ao salvar API keys: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# API - VOZES
# ============================================================================

@app.route('/api/voices/<provider>', methods=['GET'])
def get_voices(provider: str):
    """Retorna lista de vozes disponíveis do provedor"""
    try:
        if provider not in ['elevenlabs', 'minimax']:
            return jsonify({'success': False, 'error': 'Provedor inválido'}), 400
        
        audio_gen = AudioGenerator(provider=provider)
        voices = audio_gen.get_available_voices()
        
        if voices and len(voices) > 0:
            voice_list = [voice['name'] for voice in voices]
            return jsonify({
                'success': True,
                'voices': voice_list
            })
        else:
            return jsonify({
                'success': False,
                'error': f'Nenhuma voz disponível. Verifique a API key do {provider}'
            }), 400
            
    except Exception as e:
        logger.error(f"Erro ao obter vozes do {provider}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# API - ESTIMATIVA
# ============================================================================

@app.route('/api/estimate', methods=['POST'])
def estimate_job():
    """Calcula estimativa de custo e tempo"""
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text or not text.strip():
            return jsonify({'success': False, 'error': 'Texto não fornecido'}), 400
        
        temp_mgr = JobManager()
        estimate = temp_mgr.get_job_estimate(text)
        
        return jsonify({
            'success': True,
            'estimate': estimate
        })
        
    except Exception as e:
        logger.error(f"Erro ao calcular estimativa: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# API - PREVIEW
# ============================================================================

@app.route('/api/preview', methods=['POST'])
def generate_preview():
    """Gera preview dos roteiros com batches"""
    try:
        data = request.json
        scripts_text = data.get('scripts_text', '')
        batch_size = data.get('batch_size', Config.BATCH_SIZE)

        # Valida batch_size (entre 1 e 10)
        batch_size = max(1, min(10, int(batch_size)))

        if not scripts_text or not scripts_text.strip():
            return jsonify({'success': False, 'error': 'Texto não fornecido'}), 400

        # Separa roteiros por "---"
        raw_scripts = [s.strip() for s in scripts_text.split('---') if s.strip()]

        if not raw_scripts:
            return jsonify({'success': False, 'error': 'Nenhum roteiro encontrado'}), 400

        scripts_data = []

        for idx, script in enumerate(raw_scripts, 1):
            # Divide em parágrafos
            paragraphs = split_into_paragraphs(script)

            # Cria batches usando o tamanho especificado pelo usuário
            batches = create_batches(paragraphs, batch_size)
            
            # Monta estrutura do roteiro
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
        
        return jsonify({
            'success': True,
            'scripts': scripts_data,
            'summary': {
                'total_scripts': len(scripts_data),
                'total_batches': total_batches,
                'total_chars': total_chars
            }
        })
        
    except Exception as e:
        logger.error(f"Erro ao gerar preview: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# API - UPLOAD DE IMAGENS
# ============================================================================

@app.route('/api/upload/images', methods=['POST'])
def upload_images():
    """Faz upload de imagens"""
    try:
        if 'images' not in request.files:
            return jsonify({'success': False, 'error': 'Nenhuma imagem enviada'}), 400
        
        files = request.files.getlist('images')
        
        if not files or len(files) == 0:
            return jsonify({'success': False, 'error': 'Nenhuma imagem enviada'}), 400
        
        uploaded_paths = []
        
        for file in files:
            if file.filename == '':
                continue
            
            filename = secure_filename(file.filename)
            filepath = UPLOAD_FOLDER / filename
            file.save(str(filepath))
            uploaded_paths.append(str(filepath))
        
        if not uploaded_paths:
            return jsonify({'success': False, 'error': 'Nenhuma imagem válida'}), 400
        
        return jsonify({
            'success': True,
            'paths': uploaded_paths,
            'count': len(uploaded_paths)
        })
        
    except Exception as e:
        logger.error(f"Erro ao fazer upload de imagens: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# API - GERAÇÃO DE VÍDEOS
# ============================================================================

@app.route('/api/generate/single', methods=['POST'])
def generate_single_video():
    """Gera um vídeo único"""
    try:
        data = request.json
        
        text = data.get('text', '')
        provider = data.get('provider', 'elevenlabs')
        voice_name = data.get('voice_name', '')
        model_id = data.get('model_id', 'eleven_multilingual_v2')
        image_paths = data.get('image_paths', [])
        max_workers = data.get('max_workers', 3)
        
        # Validação
        if not text or not text.strip():
            return jsonify({'success': False, 'error': 'Texto não fornecido'}), 400
        
        if not voice_name:
            return jsonify({'success': False, 'error': 'Voz não selecionada'}), 400
        
        if not image_paths or len(image_paths) == 0:
            return jsonify({'success': False, 'error': 'Nenhuma imagem fornecida'}), 400
        
        # Cria job manager
        job_mgr = JobManager(audio_provider=provider)
        
        # Cria job
        job, error = job_mgr.create_job(
            input_text=text,
            voice_name=voice_name,
            image_paths=image_paths,
            model_id=model_id
        )
        
        if error:
            return jsonify({'success': False, 'error': error}), 400
        
        # Create database job
        db_job = db.create_job({
            'type': 'single_video',
            'metadata': {'text_preview': text[:100]}
        })
        db_job_id = db_job['id']
        
        try:
            # Processa job
            final_video = job_mgr.process_job(
                job=job,
                max_workers_video=max_workers
            )
            
            # Update job as completed
            db.update_job(db_job_id, {
                'status': 'completed',
                'video_path': str(final_video)
            })
            
            duration = (job.completed_at - job.created_at).total_seconds()
            
            return jsonify({
                'success': True,
                'video_path': str(final_video),
                'job_id': job.job_id,
                'duration': duration
            })
        except Exception as process_error:
            db.update_job(db_job_id, {'status': 'failed'})
            raise process_error
        
    except Exception as e:
        logger.error(f"Erro ao gerar vídeo: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/generate/batch', methods=['POST'])
def generate_batch_videos():
    """Gera múltiplos vídeos em lote"""
    try:
        data = request.json

        scripts = data.get('scripts', [])
        provider = data.get('provider', 'elevenlabs')
        model_id = data.get('model_id', 'eleven_multilingual_v2')
        image_paths = data.get('image_paths', [])
        max_workers = data.get('max_workers', 3)
        voice_selections = data.get('voice_selections', [])
        batch_image_mode = data.get('batch_image_mode', 'fixed')
        batch_images = data.get('batch_images', {})  # {scriptId_batchNumber: image_path}

        # Validação
        if not scripts or len(scripts) == 0:
            return jsonify({'success': False, 'error': 'Nenhum roteiro fornecido'}), 400

        if not image_paths or len(image_paths) == 0:
            return jsonify({'success': False, 'error': 'Nenhuma imagem fornecida'}), 400

        # Cria job manager
        job_mgr = JobManager(audio_provider=provider)

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
                    # Collect images for each batch in this script
                    script_image_paths = []
                    batches = script_data.get('batches', [])

                    for batch in batches:
                        batch_number = batch.get('batch_number')
                        batch_key = f"{script_id}_{batch_number}"

                        if batch_key in batch_images:
                            batch_image_path = batch_images[batch_key]
                            if batch_image_path not in script_image_paths:
                                script_image_paths.append(batch_image_path)

                    # If no specific images found, fallback to default image_paths
                    if not script_image_paths:
                        script_image_paths = image_paths
                else:
                    # Fixed mode - use the same images for all scripts
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

                # Processa job
                final_video = job_mgr.process_job(
                    job=job,
                    max_workers_video=max_workers
                )

                duration = (job.completed_at - job.created_at).total_seconds()
                videos_gerados.append(str(final_video))

                results.append({
                    'script_id': script_id,
                    'success': True,
                    'video_path': str(final_video),
                    'duration': duration
                })

            except Exception as e:
                results.append({
                    'script_id': script_data.get('id'),
                    'success': False,
                    'error': str(e)
                })

        # Update batch job as completed
        if videos_gerados:
            db.update_job(batch_job_id, {
                'status': 'completed',
                'video_path': videos_gerados[0] if len(videos_gerados) == 1 else f'{len(videos_gerados)} vídeos'
            })
        else:
            db.update_job(batch_job_id, {'status': 'failed'})

        return jsonify({
            'success': True,
            'results': results,
            'videos_count': len(videos_gerados),
            'total_scripts': len(scripts)
        })

    except Exception as e:
        logger.error(f"Erro ao gerar vídeos em lote: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# API - DOWNLOAD DE VÍDEO
# ============================================================================

@app.route('/api/download/<path:filename>', methods=['GET'])
def download_video(filename):
    """Faz download de vídeo gerado"""
    try:
        from urllib.parse import unquote
        # Decodifica o path que pode vir URL-encoded
        decoded_filename = unquote(filename)
        video_path = Path(decoded_filename)

        if not video_path.exists():
            return jsonify({'success': False, 'error': 'Vídeo não encontrado'}), 404

        return send_file(str(video_path), as_attachment=True, download_name=video_path.name)

    except Exception as e:
        logger.error(f"Erro ao fazer download: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/stream/<path:filename>', methods=['GET'])
def stream_video(filename):
    """Stream de vídeo para visualização no navegador"""
    try:
        from urllib.parse import unquote
        # Decodifica o path que pode vir URL-encoded
        decoded_filename = unquote(filename)
        video_path = Path(decoded_filename)

        if not video_path.exists():
            return jsonify({'success': False, 'error': 'Vídeo não encontrado'}), 404

        return send_file(str(video_path), mimetype='video/mp4')

    except Exception as e:
        logger.error(f"Erro ao fazer stream: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/videos/history', methods=['GET'])
def get_video_history():
    """Lista vídeos do histórico (pasta temp/outputs)"""
    try:
        output_folder = Path('./temp/outputs')
        if not output_folder.exists():
            return jsonify({'success': True, 'videos': []})
        
        videos = []
        for video_file in output_folder.glob('*.mp4'):
            stat = video_file.stat()
            videos.append({
                'name': video_file.name,
                'path': str(video_file),
                'size': stat.st_size,
                'created_at': stat.st_mtime
            })
        
        # Sort by creation time (newest first)
        videos.sort(key=lambda x: x['created_at'], reverse=True)
        
        return jsonify({'success': True, 'videos': videos})
        
    except Exception as e:
        logger.error(f"Erro ao listar histórico: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# API - PROJECTS
# ============================================================================

@app.route('/api/projects', methods=['GET'])
def get_projects():
    """Lista todos os projetos"""
    try:
        tag_filter = request.args.get('tag')
        projects = db.get_projects(tag_filter=tag_filter)
        
        return jsonify({
            'success': True,
            'projects': projects
        })
    except Exception as e:
        logger.error(f"Erro ao listar projetos: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/projects', methods=['POST'])
def create_project():
    """Cria um novo projeto"""
    try:
        data = request.json
        name = data.get('name', '')
        description = data.get('description', '')
        tags = data.get('tags', [])
        
        if not name:
            return jsonify({'success': False, 'error': 'Nome do projeto é obrigatório'}), 400
        
        project = db.create_project(name, description, tags)
        
        return jsonify({
            'success': True,
            'project': project
        })
    except Exception as e:
        logger.error(f"Erro ao criar projeto: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    """Obtém detalhes de um projeto"""
    try:
        project = db.get_project(project_id)
        
        if not project:
            return jsonify({'success': False, 'error': 'Projeto não encontrado'}), 404
        
        return jsonify({
            'success': True,
            'project': project
        })
    except Exception as e:
        logger.error(f"Erro ao obter projeto: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    """Atualiza um projeto"""
    try:
        data = request.json
        project = db.update_project(project_id, data)
        
        if not project:
            return jsonify({'success': False, 'error': 'Projeto não encontrado'}), 404
        
        return jsonify({
            'success': True,
            'project': project
        })
    except Exception as e:
        logger.error(f"Erro ao atualizar projeto: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Deleta um projeto"""
    try:
        db.delete_project(project_id)
        
        return jsonify({
            'success': True,
            'message': 'Projeto deletado com sucesso'
        })
    except Exception as e:
        logger.error(f"Erro ao deletar projeto: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/projects/<project_id>/videos', methods=['POST'])
def add_video_to_project(project_id):
    """Adiciona vídeo a um projeto"""
    try:
        data = request.json
        success = db.add_video_to_project(project_id, data)
        
        if not success:
            return jsonify({'success': False, 'error': 'Projeto não encontrado'}), 404
        
        return jsonify({
            'success': True,
            'message': 'Vídeo adicionado ao projeto'
        })
    except Exception as e:
        logger.error(f"Erro ao adicionar vídeo: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# API - AVATARS
# ============================================================================

@app.route('/api/avatars', methods=['GET'])
def get_avatars():
    """Lista todos os avatares"""
    try:
        avatars = db.get_avatars()
        
        return jsonify({
            'success': True,
            'avatars': avatars
        })
    except Exception as e:
        logger.error(f"Erro ao listar avatares: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/avatars', methods=['POST'])
def create_avatar():
    """Cria um novo avatar (salva imagem template)"""
    try:
        from datetime import datetime
        
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'Nenhuma imagem enviada'}), 400
        
        file = request.files['image']
        name = request.form.get('name', file.filename)
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'Arquivo inválido'}), 400
        
        # Salva imagem
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        
        avatar_path = db.avatars_dir / unique_filename
        file.save(str(avatar_path))
        
        # Cria thumbnail (simplificado - usa a mesma imagem)
        thumbnail_path = db.avatars_dir / "thumbnails" / unique_filename
        file.seek(0)  # Reset file pointer
        file.save(str(thumbnail_path))
        
        # Salva no banco
        avatar = db.create_avatar(name, str(avatar_path), str(thumbnail_path))
        
        return jsonify({
            'success': True,
            'avatar': avatar
        })
    except Exception as e:
        logger.error(f"Erro ao criar avatar: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/avatars/<avatar_id>', methods=['DELETE'])
def delete_avatar(avatar_id):
    """Deleta um avatar"""
    try:
        db.delete_avatar(avatar_id)
        
        return jsonify({
            'success': True,
            'message': 'Avatar deletado com sucesso'
        })
    except Exception as e:
        logger.error(f"Erro ao deletar avatar: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/avatars/<avatar_id>/image', methods=['GET'])
def get_avatar_image(avatar_id):
    """Obtém imagem do avatar (primeira imagem)"""
    try:
        avatar = db.get_avatar(avatar_id)

        if not avatar:
            return jsonify({'success': False, 'error': 'Avatar não encontrado'}), 404

        # Use first image from images array or legacy image_path
        if avatar.get('images') and len(avatar['images']) > 0:
            image_path = Path(avatar['images'][0]['path'])
        else:
            image_path = Path(avatar['image_path'])

        if not image_path.exists():
            return jsonify({'success': False, 'error': 'Imagem não encontrada'}), 404

        return send_file(str(image_path))
    except Exception as e:
        logger.error(f"Erro ao obter imagem: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/avatars/<avatar_id>/images', methods=['POST'])
def add_avatar_image(avatar_id):
    """Adiciona uma imagem a um avatar existente"""
    try:
        from datetime import datetime

        avatar = db.get_avatar(avatar_id)
        if not avatar:
            return jsonify({'success': False, 'error': 'Avatar não encontrado'}), 404

        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'Nenhuma imagem enviada'}), 400

        file = request.files['image']

        if file.filename == '':
            return jsonify({'success': False, 'error': 'Arquivo inválido'}), 400

        # Salva imagem
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_filename = f"{timestamp}_{filename}"

        image_path = db.avatars_dir / unique_filename
        file.save(str(image_path))

        # Cria thumbnail
        thumbnail_path = db.avatars_dir / "thumbnails" / unique_filename
        file.seek(0)
        file.save(str(thumbnail_path))

        # Adiciona ao banco
        new_image = db.add_image_to_avatar(avatar_id, str(image_path), str(thumbnail_path))

        if new_image:
            return jsonify({
                'success': True,
                'image': new_image
            })
        else:
            return jsonify({'success': False, 'error': 'Erro ao adicionar imagem'}), 500
    except Exception as e:
        logger.error(f"Erro ao adicionar imagem ao avatar: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/avatars/<avatar_id>/images/<image_id>', methods=['GET'])
def get_avatar_specific_image(avatar_id, image_id):
    """Obtém uma imagem específica do avatar"""
    try:
        avatar = db.get_avatar(avatar_id)

        if not avatar:
            return jsonify({'success': False, 'error': 'Avatar não encontrado'}), 404

        if 'images' not in avatar:
            return jsonify({'success': False, 'error': 'Avatar sem imagens'}), 404

        # Find specific image
        for img in avatar['images']:
            if img['id'] == image_id:
                image_path = Path(img['path'])
                if not image_path.exists():
                    return jsonify({'success': False, 'error': 'Imagem não encontrada'}), 404
                return send_file(str(image_path))

        return jsonify({'success': False, 'error': 'Imagem não encontrada'}), 404
    except Exception as e:
        logger.error(f"Erro ao obter imagem específica: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/avatars/<avatar_id>/images/<image_id>', methods=['DELETE'])
def delete_avatar_image(avatar_id, image_id):
    """Deleta uma imagem específica do avatar"""
    try:
        avatar = db.get_avatar(avatar_id)

        if not avatar:
            return jsonify({'success': False, 'error': 'Avatar não encontrado'}), 404

        # Check if it's the last image
        if avatar.get('images') and len(avatar['images']) <= 1:
            return jsonify({'success': False, 'error': 'Não é possível deletar a última imagem do avatar'}), 400

        success = db.delete_image_from_avatar(avatar_id, image_id)

        if success:
            return jsonify({
                'success': True,
                'message': 'Imagem deletada com sucesso'
            })
        else:
            return jsonify({'success': False, 'error': 'Imagem não encontrada'}), 404
    except Exception as e:
        logger.error(f"Erro ao deletar imagem: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/gemini/select-images', methods=['POST'])
def gemini_select_images():
    """Usa Gemini para selecionar a melhor imagem para cada batch"""
    try:
        import google.generativeai as genai
        import base64

        data = request.json

        if not data:
            return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400

        avatar_id = data.get('avatar_id')
        batches = data.get('batches', [])  # [{batch_number: 1, text: "..."}, ...]

        if not avatar_id or not batches:
            return jsonify({'success': False, 'error': 'avatar_id e batches são obrigatórios'}), 400

        avatar = db.get_avatar(avatar_id)
        if not avatar:
            return jsonify({'success': False, 'error': 'Avatar não encontrado'}), 404

        images = avatar.get('images', [])
        if len(images) < 2:
            # If only one image, use it for all batches
            single_image_id = images[0]['id'] if images else None
            return jsonify({
                'success': True,
                'selections': {str(b['batch_number']): single_image_id for b in batches}
            })

        # Configure Gemini
        genai.configure(api_key=Config.GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash')

        # Prepare image data for Gemini
        image_parts = []
        image_descriptions = []

        for idx, img in enumerate(images):
            img_path = Path(img['path'])
            if img_path.exists():
                with open(img_path, 'rb') as f:
                    img_data = base64.b64encode(f.read()).decode('utf-8')
                    mime_type = 'image/png' if img_path.suffix.lower() == '.png' else 'image/jpeg'
                    image_parts.append({
                        'mime_type': mime_type,
                        'data': img_data
                    })
                    image_descriptions.append(f"Imagem {idx + 1} (ID: {img['id']})")

        # Build prompt for Gemini
        batch_texts = "\n\n".join([
            f"BATCH {b['batch_number']}:\n{b['text']}"
            for b in batches
        ])

        prompt = f"""Você é um especialista em seleção de imagens para vídeos de lip-sync.

Analise as {len(images)} imagens fornecidas e os textos dos batches abaixo.
Para cada batch, escolha a imagem que melhor combina com o tom e conteúdo do texto.

IMAGENS DISPONÍVEIS:
{chr(10).join(image_descriptions)}

TEXTOS DOS BATCHES:
{batch_texts}

INSTRUÇÕES:
1. Analise o sentimento e tom de cada batch
2. Considere qual expressão facial/pose da imagem combina melhor
3. Retorne APENAS um JSON no formato: {{"1": "img_xxx", "2": "img_yyy", ...}}
4. As chaves são os números dos batches
5. Os valores são os IDs das imagens (ex: img_abc123)

RESPOSTA (apenas JSON):"""

        # Call Gemini with images and prompt
        contents = []
        for img_part in image_parts:
            contents.append({
                'inline_data': img_part
            })
        contents.append(prompt)

        response = model.generate_content(contents)
        response_text = response.text.strip()

        # Parse JSON response
        import json
        import re

        # Extract JSON from response
        json_match = re.search(r'\{[^{}]+\}', response_text)
        if json_match:
            selections = json.loads(json_match.group())
        else:
            # Fallback: use first image for all
            selections = {str(b['batch_number']): images[0]['id'] for b in batches}

        return jsonify({
            'success': True,
            'selections': selections
        })

    except Exception as e:
        logger.error(f"Erro na seleção automática de imagens: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# API - JOBS (Timeline de processamento)
# ============================================================================

@app.route('/api/jobs', methods=['GET'])
def get_jobs():
    """Lista jobs (timeline de processamento)"""
    try:
        status = request.args.get('status')  # processing, completed, failed
        limit = int(request.args.get('limit', 50))
        
        jobs = db.get_jobs(status=status, limit=limit)
        
        return jsonify({
            'success': True,
            'jobs': jobs
        })
    except Exception as e:
        logger.error(f"Erro ao listar jobs: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/jobs/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """Obtém status de um job específico"""
    try:
        job = db.get_job(job_id)
        
        if not job:
            return jsonify({'success': False, 'error': 'Job não encontrado'}), 404
        
        return jsonify({
            'success': True,
            'job': job
        })
    except Exception as e:
        logger.error(f"Erro ao obter job: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# API - TAGS
# ============================================================================

@app.route('/api/tags', methods=['GET'])
def get_tags():
    """Lista todas as tags"""
    try:
        tags = db.get_tags()
        
        return jsonify({
            'success': True,
            'tags': tags
        })
    except Exception as e:
        logger.error(f"Erro ao listar tags: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tags', methods=['POST'])
def create_tag():
    """Cria uma nova tag"""
    try:
        data = request.json
        name = data.get('name', '')
        color = data.get('color', '#667eea')
        
        if not name:
            return jsonify({'success': False, 'error': 'Nome da tag é obrigatório'}), 400
        
        tag = db.create_tag(name, color)
        
        return jsonify({
            'success': True,
            'tag': tag
        })
    except Exception as e:
        logger.error(f"Erro ao criar tag: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tags/<tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    """Deleta uma tag"""
    try:
        db.delete_tag(tag_id)
        
        return jsonify({
            'success': True,
            'message': 'Tag deletada com sucesso'
        })
    except Exception as e:
        logger.error(f"Erro ao deletar tag: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# INICIALIZAÇÃO
# ============================================================================

if __name__ == '__main__':
    print("\n" + "="*60)
    print("  LipSync Video Generator - Web Interface")
    print("="*60)
    print("\n  Interface web moderna com configuração de API keys integrada")
    print(f"\n  🌐 Acesse: http://localhost:5000")
    print(f"  📁 Pasta de uploads: {UPLOAD_FOLDER}")
    print("\n" + "="*60 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
