# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file para LipSync Video Generator
Para gerar o executável, execute: pyinstaller lipsync.spec
"""

import os
from pathlib import Path

# Diretório base do projeto
BASE_DIR = Path(SPECPATH)

# Análise do script principal
a = Analysis(
    ['main_windows.py'],
    pathex=[str(BASE_DIR)],
    binaries=[],
    datas=[
        # Pasta static com HTML, CSS e JS
        ('static', 'static'),
        # Pasta data (será criada se não existir)
        ('data', 'data') if Path('data').exists() else ('', ''),
    ],
    hiddenimports=[
        # Flask e extensões
        'flask',
        'flask_cors',
        'werkzeug',
        'werkzeug.utils',
        'werkzeug.serving',
        'werkzeug.security',
        'jinja2',
        'markupsafe',
        'click',
        'itsdangerous',
        'blinker',

        # Requests e HTTP
        'requests',
        'urllib3',
        'certifi',
        'charset_normalizer',
        'idna',

        # Google Generative AI
        'google.generativeai',
        'google.ai.generativelanguage',
        'google.api_core',
        'google.auth',
        'google.protobuf',
        'proto',
        'grpc',

        # Outros
        'PIL',
        'PIL.Image',
        'dotenv',
        'python-dotenv',
        'json',
        'uuid',
        'pathlib',
        'threading',
        'concurrent.futures',
        'logging',
        'socket',
        'webbrowser',

        # Módulos do projeto
        'config',
        'web_server',
        'job_manager',
        'text_processor',
        'audio_generator',
        'video_generator',
        'video_concatenator',
        'database',
        'utils',
        'project_manager',
        'wavespeed_uploader',

        # Waitress (servidor de produção opcional)
        'waitress',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclui módulos não necessários para reduzir tamanho
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'cv2',
        'torch',
        'tensorflow',
        'PyQt5',
        'PyQt6',
        'PySide2',
        'PySide6',
        'gradio',  # Não usamos gradio no modo web
    ],
    noarchive=False,
    optimize=0,
)

# Remove datas vazias
a.datas = [d for d in a.datas if d[0]]

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='LipSync Video Generator',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # True para ver logs no console; False para esconder
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # Adicione um ícone .ico aqui se tiver: icon='icon.ico'
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='LipSync Video Generator',
)
