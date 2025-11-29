# -*- mode: python ; coding: utf-8 -*-
"""
LipSync Video Generator - PyInstaller Build Specification
Generates a single executable for Windows/Mac/Linux

Usage:
    pyinstaller build.spec

Output:
    dist/LipSyncVideoGenerator.exe (Windows)
    dist/LipSyncVideoGenerator (Mac/Linux)
"""

import sys
from pathlib import Path

block_cipher = None

# Get the directory containing this spec file
spec_dir = Path(SPECPATH)

# Analysis - collects all imports and data
a = Analysis(
    ['app_main.py'],
    pathex=[str(spec_dir)],
    binaries=[],
    datas=[
        # Static files (HTML/CSS/JS)
        ('static', 'static'),

        # Data directory template
        ('data', 'data') if Path('data').exists() else (None, None),

        # Temp directory template (create empty)
        ('temp', 'temp') if Path('temp').exists() else (None, None),
    ],
    hiddenimports=[
        # Eel and dependencies
        'eel',
        'bottle',
        'bottle_websocket',
        'gevent',
        'gevent.websocket',
        'geventwebsocket',
        'geventwebsocket.handler',
        'geventwebsocket.websocket',

        # Web server
        'werkzeug',
        'werkzeug.utils',
        'flask',

        # API clients
        'elevenlabs',
        'elevenlabs.client',
        'google.generativeai',
        'google.ai.generativelanguage',

        # Core modules
        'PIL',
        'PIL.Image',
        'requests',
        'dotenv',

        # Project modules
        'config',
        'utils',
        'database',
        'job_manager',
        'text_processor',
        'audio_generator',
        'video_generator',
        'video_concatenator',
        'wavespeed_uploader',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude unnecessary modules to reduce size
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'IPython',
        'jupyter',
        'notebook',
        'gradio',  # Not needed for desktop
        'pytest',
        'unittest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# Filter out None entries from datas
a.datas = [d for d in a.datas if d[0] is not None]

# PYZ - creates the python archive
pyz = PYZ(
    a.pure,
    a.zipped_data,
    cipher=block_cipher,
)

# EXE - creates the executable
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='LipSyncVideoGenerator',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # NO CONSOLE WINDOW!
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico' if Path('icon.ico').exists() else None,
    version='version_info.txt' if Path('version_info.txt').exists() else None,
)

# For Mac - creates .app bundle
if sys.platform == 'darwin':
    app = BUNDLE(
        exe,
        name='LipSyncVideoGenerator.app',
        icon='icon.icns' if Path('icon.icns').exists() else None,
        bundle_identifier='com.lipsync.videogenerator',
        info_plist={
            'NSHighResolutionCapable': 'True',
            'CFBundleShortVersionString': '2.0.0',
            'CFBundleVersion': '2.0.0',
        },
    )
