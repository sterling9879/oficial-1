/**
 * LipSync Video Generator - Desktop Application (Eel)
 * Interface adaptada para comunicação com Python via Eel
 */

// ============================================================================
// STATE & CONFIG
// ============================================================================

const state = {
    // Image management
    singleImages: [],
    multiImages: [],
    uploadedImagePaths: [],

    // Avatar state
    avatars: [],
    selectedAvatarId: null,
    selectedAvatarPath: null,
    pendingAvatarFile: null,

    // Batch image mode
    batchImageMode: 'fixed', // 'fixed' or 'individual'
    batchImages: {}, // {scriptId_batchNumber: avatarId}

    // Preview state
    previewData: null,
    voiceSelections: [],

    // Processing state
    currentVideoPath: null,
    processingJobs: [],
    completedVideos: [],

    // Projects
    projects: [],
    currentProject: null,
    tags: [],

    // Desktop mode
    isDesktopMode: typeof eel !== 'undefined'
};

// ============================================================================
// EEL EXPOSED FUNCTIONS (called from Python)
// ============================================================================

// Callback para atualizar progresso
eel.expose(updateProgress);
function updateProgress(message, percent) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    if (progressFill) {
        progressFill.style.width = `${percent}%`;
    }
    if (progressText) {
        progressText.textContent = message;
    }

    console.log(`Progress: ${percent}% - ${message}`);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('LipSync Video Generator - Desktop Mode');

    initTabs();
    initSettings();
    initSliders();
    initImageUpload();
    initVoiceSelectors();
    initAvatarUpload();
    loadApiKeyStatus();
    loadAvatars();
    loadProjects();
    loadVideoHistory();
    loadProcessingJobs();

    // Event listeners
    document.getElementById('btnEstimate').addEventListener('click', calculateEstimate);
    document.getElementById('btnGenerate').addEventListener('click', generateSingleVideo);
    document.getElementById('btnGeneratePreview').addEventListener('click', generatePreview);
    document.getElementById('btnDownload').addEventListener('click', downloadVideo);

    // Refresh buttons
    document.getElementById('btnUploadAvatar').addEventListener('click', showAvatarUploadBox);

    // Check FFmpeg
    checkFFmpeg();
});

async function checkFFmpeg() {
    try {
        const result = await eel.check_ffmpeg()();
        if (!result.installed) {
            showMessage('statusMessages', 'FFmpeg nao encontrado. Instale FFmpeg para gerar videos.', 'error');
        }
    } catch (e) {
        console.error('Erro ao verificar FFmpeg:', e);
    }
}

// ============================================================================
// TABS NAVIGATION
// ============================================================================

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `tab-${tabId}`) {
                    content.classList.add('active');
                }
            });

            // Load data for specific tabs
            if (tabId === 'history') {
                loadVideoHistory();
            } else if (tabId === 'avatars') {
                loadAvatars();
            } else if (tabId === 'projects') {
                loadProjects();
            } else if (tabId === 'loading') {
                loadProcessingJobs();
            }
        });
    });
}

// ============================================================================
// SETTINGS MODAL
// ============================================================================

function initSettings() {
    const modal = document.getElementById('settingsModal');
    const btnOpen = document.getElementById('btnOpenSettings');
    const btnClose = document.getElementById('btnCloseSettings');
    const btnCancel = document.getElementById('btnCancelSettings');
    const btnSave = document.getElementById('btnSaveSettings');
    const overlay = document.getElementById('modalOverlay');

    btnOpen.addEventListener('click', () => modal.classList.add('active'));
    btnClose.addEventListener('click', () => modal.classList.remove('active'));
    btnCancel.addEventListener('click', () => modal.classList.remove('active'));
    overlay.addEventListener('click', () => modal.classList.remove('active'));

    btnSave.addEventListener('click', saveApiKeys);
}

async function loadApiKeyStatus() {
    try {
        const data = await eel.get_api_keys_status()();

        if (data.success) {
            updateApiStatus('Elevenlabs', data.keys.elevenlabs);
            updateApiStatus('Minimax', data.keys.minimax);
            updateApiStatus('Gemini', data.keys.gemini);
            updateApiStatus('Wavespeed', data.keys.wavespeed);
        }
    } catch (error) {
        console.error('Erro ao verificar API keys:', error);
    }
}

function updateApiStatus(name, configured) {
    const status = document.getElementById(`status${name}`);
    if (status) {
        status.textContent = configured ? 'Configurada' : 'Pendente';
        status.className = `api-status ${configured ? 'configured' : 'not-configured'}`;
    }
}

async function saveApiKeys() {
    const data = {
        elevenlabs_api_key: document.getElementById('apiKeyElevenlabs').value,
        minimax_api_key: document.getElementById('apiKeyMinimax').value,
        gemini_api_key: document.getElementById('apiKeyGemini').value,
        wavespeed_api_key: document.getElementById('apiKeyWavespeed').value
    };

    try {
        const result = await eel.save_api_keys(data)();

        if (result.success) {
            showMessage('statusMessages', result.message, 'success');
            document.getElementById('settingsModal').classList.remove('active');
            loadApiKeyStatus();
            loadVoices('single');
            loadVoices('multi');
        } else {
            showMessage('statusMessages', result.error, 'error');
        }
    } catch (error) {
        showMessage('statusMessages', 'Erro ao salvar configuracoes', 'error');
    }
}

// ============================================================================
// SLIDERS
// ============================================================================

function initSliders() {
    const singleSlider = document.getElementById('singleWorkers');
    const singleValue = document.getElementById('singleWorkersValue');
    const multiSlider = document.getElementById('multiWorkers');
    const multiValue = document.getElementById('multiWorkersValue');

    singleSlider.addEventListener('input', () => {
        singleValue.textContent = singleSlider.value;
    });

    multiSlider.addEventListener('input', () => {
        multiValue.textContent = multiSlider.value;
    });
}

// ============================================================================
// IMAGE SOURCE TOGGLE
// ============================================================================

function toggleImageSource(context, source) {
    const avatarSelector = document.getElementById(`${context}AvatarSelector`);
    const uploadSection = document.getElementById(`${context}UploadSection`);
    const parentGroup = avatarSelector.closest('.form-group');
    const toggleBtns = parentGroup.querySelectorAll('.toggle-btn');

    toggleBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.source === source);
    });

    if (source === 'avatars') {
        avatarSelector.style.display = 'grid';
        uploadSection.style.display = 'none';
    } else {
        avatarSelector.style.display = 'none';
        uploadSection.style.display = 'block';
    }
}

// ============================================================================
// BATCH IMAGE MODE
// ============================================================================

function setBatchImageMode(mode) {
    state.batchImageMode = mode;

    document.querySelectorAll('.batch-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const fixedSection = document.getElementById('fixedImageSection');
    if (mode === 'fixed') {
        fixedSection.style.display = 'block';
    } else {
        fixedSection.style.display = 'none';
    }

    if (state.previewData) {
        renderPreview(state.previewData);
    }
}

// ============================================================================
// IMAGE UPLOAD
// ============================================================================

function initImageUpload() {
    const singleUploadArea = document.getElementById('singleUploadArea');
    const singleInput = document.getElementById('singleImages');

    singleUploadArea.addEventListener('click', () => singleInput.click());
    singleUploadArea.addEventListener('dragover', handleDragOver);
    singleUploadArea.addEventListener('drop', (e) => handleDrop(e, 'single'));
    singleInput.addEventListener('change', (e) => handleFileSelect(e, 'single'));

    const multiUploadArea = document.getElementById('multiUploadArea');
    const multiInput = document.getElementById('multiImages');

    multiUploadArea.addEventListener('click', () => multiInput.click());
    multiUploadArea.addEventListener('dragover', handleDragOver);
    multiUploadArea.addEventListener('drop', (e) => handleDrop(e, 'multi'));
    multiInput.addEventListener('change', (e) => handleFileSelect(e, 'multi'));
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDrop(e, context) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    addImages(files, context);
}

function handleFileSelect(e, context) {
    const files = Array.from(e.target.files);
    addImages(files, context);
}

function addImages(files, context) {
    const currentImages = context === 'single' ? state.singleImages : state.multiImages;
    const maxImages = 20;

    if (currentImages.length + files.length > maxImages) {
        showMessage('statusMessages', `Maximo de ${maxImages} imagens permitidas`, 'error');
        return;
    }

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (context === 'single') {
                state.singleImages.push({ file, preview: e.target.result, name: file.name });
            } else {
                state.multiImages.push({ file, preview: e.target.result, name: file.name });
            }
            renderImagePreviews(context);
        };
        reader.readAsDataURL(file);
    });
}

function renderImagePreviews(context) {
    const images = context === 'single' ? state.singleImages : state.multiImages;
    const container = document.getElementById(`${context}ImagePreview`);

    container.innerHTML = images.map((img, idx) => `
        <div class="image-preview-item">
            <img src="${img.preview}" alt="Preview ${idx + 1}">
            <button class="image-preview-remove" onclick="removeImage(${idx}, '${context}')">&times;</button>
        </div>
    `).join('');
}

function removeImage(index, context) {
    if (context === 'single') {
        state.singleImages.splice(index, 1);
    } else {
        state.multiImages.splice(index, 1);
    }
    renderImagePreviews(context);
}

// ============================================================================
// AVATAR MANAGEMENT
// ============================================================================

async function loadAvatars() {
    try {
        const data = await eel.get_avatars()();

        if (data.success) {
            state.avatars = data.avatars;
            renderAvatarsGallery();
            renderAvatarSelectors();
        }
    } catch (error) {
        console.error('Erro ao carregar avatares:', error);
    }
}

async function renderAvatarsGallery() {
    const gallery = document.getElementById('avatarsGallery');

    if (state.avatars.length === 0) {
        gallery.innerHTML = `
            <div class="empty-state-large">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <p>Nenhum avatar salvo ainda</p>
                <p class="hint">Faca upload de imagens template para usar nos videos</p>
            </div>
        `;
        return;
    }

    let html = '';
    for (const avatar of state.avatars) {
        const imgData = await eel.get_avatar_image_base64(avatar.id)();
        const imgSrc = imgData.success ? imgData.data : '';

        html += `
            <div class="avatar-card" data-id="${avatar.id}">
                <img class="avatar-card-image" src="${imgSrc}" alt="${avatar.name}">
                <div class="avatar-card-info">
                    <div class="avatar-card-name">${avatar.name}</div>
                    <div class="avatar-card-date">${formatDate(avatar.created_at)}</div>
                    <div class="avatar-card-actions">
                        <button class="avatar-card-btn" onclick="selectAvatarForUse('${avatar.id}')">Usar</button>
                        <button class="avatar-card-btn danger" onclick="deleteAvatar('${avatar.id}')">Excluir</button>
                    </div>
                </div>
            </div>
        `;
    }

    gallery.innerHTML = html;
}

async function renderAvatarSelectors() {
    const selectors = ['singleAvatarSelector', 'multiAvatarSelector'];

    for (const selectorId of selectors) {
        const selector = document.getElementById(selectorId);
        if (!selector) continue;

        if (state.avatars.length === 0) {
            selector.innerHTML = '<p class="loading-text">Nenhum avatar disponivel. Faca upload na aba "My Avatars"</p>';
            continue;
        }

        let html = '';
        for (const avatar of state.avatars) {
            const imgData = await eel.get_avatar_image_base64(avatar.id)();
            const imgSrc = imgData.success ? imgData.data : '';

            html += `
                <div class="avatar-selector-item ${state.selectedAvatarId === avatar.id ? 'selected' : ''}"
                     data-id="${avatar.id}"
                     data-path="${avatar.image_path}"
                     onclick="selectAvatar('${avatar.id}', '${avatar.image_path}')">
                    <img class="avatar-selector-thumb" src="${imgSrc}" alt="${avatar.name}">
                    <span class="avatar-selector-name">${avatar.name}</span>
                </div>
            `;
        }

        selector.innerHTML = html;
    }
}

function selectAvatar(avatarId, avatarPath) {
    state.selectedAvatarId = avatarId;
    state.selectedAvatarPath = avatarPath;

    document.querySelectorAll('.avatar-selector-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.id === avatarId);
    });
}

function selectAvatarForUse(avatarId) {
    const avatar = state.avatars.find(a => a.id === avatarId);
    if (avatar) {
        selectAvatar(avatarId, avatar.image_path);
        document.querySelector('[data-tab="single"]').click();
        toggleImageSource('single', 'avatars');
    }
}

async function deleteAvatar(avatarId) {
    if (!confirm('Tem certeza que deseja excluir este avatar?')) return;

    try {
        const data = await eel.delete_avatar(avatarId)();

        if (data.success) {
            if (state.selectedAvatarId === avatarId) {
                state.selectedAvatarId = null;
                state.selectedAvatarPath = null;
            }
            loadAvatars();
        } else {
            alert('Erro ao excluir avatar: ' + data.error);
        }
    } catch (error) {
        console.error('Erro ao excluir avatar:', error);
    }
}

// ============================================================================
// AVATAR UPLOAD
// ============================================================================

function initAvatarUpload() {
    const input = document.getElementById('avatarUploadInput');
    const placeholder = document.getElementById('avatarPreviewPlaceholder');

    input.addEventListener('change', handleAvatarFileSelect);
    if (placeholder) {
        placeholder.addEventListener('click', () => input.click());
    }
}

function showAvatarUploadBox() {
    const uploadBox = document.getElementById('avatarUploadBox');
    uploadBox.style.display = 'flex';

    state.pendingAvatarFile = null;
    state.pendingAvatarData = null;
    document.getElementById('avatarName').value = '';
    document.getElementById('avatarPreviewImage').style.display = 'none';
    document.getElementById('avatarPreviewPlaceholder').style.display = 'flex';
}

function cancelAvatarUpload() {
    const uploadBox = document.getElementById('avatarUploadBox');
    uploadBox.style.display = 'none';
    state.pendingAvatarFile = null;
    state.pendingAvatarData = null;
}

function handleAvatarFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    state.pendingAvatarFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        state.pendingAvatarData = e.target.result;

        const previewImg = document.getElementById('avatarPreviewImage');
        const placeholder = document.getElementById('avatarPreviewPlaceholder');

        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);

    const nameInput = document.getElementById('avatarName');
    if (!nameInput.value) {
        nameInput.value = file.name.replace(/\.[^/.]+$/, '');
    }
}

async function saveAvatar() {
    if (!state.pendingAvatarData) {
        alert('Selecione uma imagem primeiro');
        return;
    }

    const name = document.getElementById('avatarName').value || state.pendingAvatarFile.name;

    try {
        const data = await eel.create_avatar(name, state.pendingAvatarData)();

        if (data.success) {
            cancelAvatarUpload();
            loadAvatars();
        } else {
            alert('Erro ao salvar avatar: ' + data.error);
        }
    } catch (error) {
        console.error('Erro ao salvar avatar:', error);
        alert('Erro ao salvar avatar');
    }
}

// ============================================================================
// VOICE SELECTORS
// ============================================================================

function initVoiceSelectors() {
    const singleProvider = document.getElementById('singleProvider');
    const multiProvider = document.getElementById('multiProvider');

    singleProvider.addEventListener('change', () => loadVoices('single'));
    multiProvider.addEventListener('change', () => loadVoices('multi'));

    loadVoices('single');
    loadVoices('multi');
}

async function loadVoices(context) {
    const providerSelect = document.getElementById(`${context}Provider`);
    const voiceSelect = document.getElementById(`${context}Voice`);
    const provider = providerSelect.value;

    if (!voiceSelect) return;

    voiceSelect.innerHTML = '<option value="">Carregando...</option>';

    try {
        const data = await eel.get_voices(provider)();

        if (data.success && data.voices.length > 0) {
            voiceSelect.innerHTML = data.voices.map(voice =>
                `<option value="${voice}">${voice}</option>`
            ).join('');
        } else {
            voiceSelect.innerHTML = '<option value="">Nenhuma voz disponivel</option>';
        }
    } catch (error) {
        console.error(`Erro ao carregar vozes:`, error);
        voiceSelect.innerHTML = '<option value="">Erro ao carregar vozes</option>';
    }
}

// ============================================================================
// ESTIMATE
// ============================================================================

async function calculateEstimate() {
    const text = document.getElementById('singleText').value;

    if (!text.trim()) {
        showMessage('statusMessages', 'Digite um texto para estimar', 'error');
        return;
    }

    try {
        const data = await eel.estimate_job(text)();

        if (data.success) {
            const est = data.estimate;
            document.getElementById('estimateCard').style.display = 'block';
            document.getElementById('estimateContent').innerHTML = `
                <p><strong>Caracteres:</strong> ${est.num_chars ? est.num_chars.toLocaleString() : 0}</p>
                <p><strong>Batches:</strong> ${est.num_batches || 0}</p>
                <p><strong>Videos:</strong> ${est.num_videos || 0}</p>
                <p><strong>Tempo estimado:</strong> ${est.estimated_time || 'N/A'}</p>
                <p><strong>Custo estimado:</strong> ${est.estimated_cost?.total || 'N/A'}</p>
            `;
        } else {
            showMessage('statusMessages', data.error, 'error');
        }
    } catch (error) {
        showMessage('statusMessages', 'Erro ao calcular estimativa', 'error');
    }
}

// ============================================================================
// SINGLE VIDEO GENERATION
// ============================================================================

async function generateSingleVideo() {
    const text = document.getElementById('singleText').value;
    const provider = document.getElementById('singleProvider').value;
    const voice = document.getElementById('singleVoice').value;
    const model = document.getElementById('singleModel').value;
    const workers = parseInt(document.getElementById('singleWorkers').value);

    // Validation
    if (!text.trim()) {
        showMessage('statusMessages', 'Digite um roteiro', 'error');
        return;
    }

    if (!voice) {
        showMessage('statusMessages', 'Selecione uma voz', 'error');
        return;
    }

    // Get image paths
    let imagePaths = [];

    if (state.selectedAvatarPath) {
        imagePaths = [state.selectedAvatarPath];
    } else if (state.singleImages.length > 0) {
        // Upload images first
        imagePaths = await uploadImages(state.singleImages);
    }

    if (imagePaths.length === 0) {
        showMessage('statusMessages', 'Selecione pelo menos uma imagem', 'error');
        return;
    }

    // Show progress
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const videoContainer = document.getElementById('videoContainer');

    progressContainer.style.display = 'block';
    videoContainer.style.display = 'none';
    progressFill.style.width = '0%';
    progressText.textContent = 'Iniciando geracao...';

    // Add to loading tab
    const tempJobId = Date.now().toString();
    addToLoadingTab({
        id: tempJobId,
        title: 'Video em processamento',
        text: text.substring(0, 100) + '...',
        status: 'processing'
    });

    // Switch to loading tab
    document.querySelector('[data-tab="loading"]').click();

    try {
        const data = await eel.generate_single_video({
            text,
            provider,
            voice_name: voice,
            model_id: model,
            image_paths: imagePaths,
            max_workers: workers
        })();

        if (data.success) {
            progressFill.style.width = '100%';
            progressText.textContent = 'Video gerado com sucesso!';

            state.currentVideoPath = data.video_path;

            // Get video as base64 for playback
            const videoData = await eel.get_video_base64(data.video_path)();
            if (videoData.success) {
                const videoPlayer = document.getElementById('videoPlayer');
                videoPlayer.src = videoData.data;
                videoContainer.style.display = 'block';
            }

            updateLoadingTabItem(tempJobId, 'completed', data.video_path);

            showMessage('statusMessages', `Video gerado em ${data.duration.toFixed(1)}s`, 'success');

            loadVideoHistory();
            loadProcessingJobs();
        } else {
            progressContainer.style.display = 'none';
            updateLoadingTabItem(tempJobId, 'failed');
            showMessage('statusMessages', data.error, 'error');
        }
    } catch (error) {
        progressContainer.style.display = 'none';
        updateLoadingTabItem(tempJobId, 'failed');
        showMessage('statusMessages', 'Erro ao gerar video', 'error');
        console.error(error);
    }
}

async function uploadImages(images) {
    const imagesData = images.map(img => ({
        name: img.name,
        data: img.preview
    }));

    try {
        const data = await eel.upload_images_base64(imagesData)();

        if (data.success) {
            return data.paths;
        }
    } catch (error) {
        console.error('Erro ao fazer upload:', error);
    }

    return [];
}

// ============================================================================
// PREVIEW GENERATION
// ============================================================================

async function generatePreview() {
    const text = document.getElementById('multiText').value;

    if (!text.trim()) {
        showMessage('statusMessages', 'Digite os roteiros', 'error');
        return;
    }

    try {
        const data = await eel.generate_preview(text)();

        if (data.success) {
            state.previewData = data;
            const voicesData = await eel.get_voices(document.getElementById('multiProvider').value)();
            state.voiceSelections = data.scripts.map(() =>
                voicesData.success && voicesData.voices.length > 0 ? voicesData.voices[0] : ''
            );
            renderPreview(data);
        } else {
            showMessage('statusMessages', data.error, 'error');
        }
    } catch (error) {
        showMessage('statusMessages', 'Erro ao gerar preview', 'error');
    }
}

async function renderPreview(data) {
    const container = document.getElementById('previewContent');
    const provider = document.getElementById('multiProvider').value;

    let voices = [];
    try {
        const voicesData = await eel.get_voices(provider)();
        voices = voicesData.success ? voicesData.voices : [];
    } catch (e) {
        console.error('Error loading voices:', e);
    }

    let html = `
        <div class="preview-summary" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
            <span class="info-badge">${data.summary.total_scripts} roteiros</span>
            <span class="info-badge">${data.summary.total_batches} batches</span>
            <span class="info-badge">${data.summary.total_chars.toLocaleString()} caracteres</span>
        </div>
    `;

    data.scripts.forEach((script, scriptIdx) => {
        html += `
            <div class="script-card">
                <div class="script-header">
                    <span class="script-title">Roteiro ${script.id}</span>
                    <span class="script-stats">${script.total_batches} batches | ${script.total_chars} chars</span>
                </div>
                <div style="margin-bottom: 1rem;">
                    <label style="color: white; font-size: 0.875rem; margin-bottom: 0.5rem; display: block;">Voz para este roteiro:</label>
                    <select class="voice-select" data-script="${scriptIdx}" onchange="updateVoiceSelection(${scriptIdx}, this.value)" style="width: 100%; padding: 0.5rem; border-radius: 8px; border: none;">
                        ${voices.map(v => `<option value="${v}">${v}</option>`).join('')}
                    </select>
                </div>
                <div class="batches-container">
        `;

        script.batches.forEach((batch, batchIdx) => {
            html += `
                <div class="batch-card">
                    <div class="batch-header">
                        <span class="batch-title">Batch ${batch.batch_number}</span>
                        <span style="font-size: 0.75rem; color: #666;">${batch.char_count} chars</span>
                    </div>
                    <div class="batch-text">${batch.text.replace(/\n/g, '<br>')}</div>
            `;

            if (state.batchImageMode === 'individual') {
                html += renderBatchImageSelector(script.id, batch.batch_number);
            }

            html += `</div>`;
        });

        html += `
                </div>
            </div>
        `;
    });

    html += `
        <button class="btn btn-primary btn-block" onclick="generateBatchVideos()" style="margin-top: 1.5rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Gerar ${data.summary.total_scripts} Videos
        </button>
    `;

    container.innerHTML = html;
}

function renderBatchImageSelector(scriptId, batchNumber) {
    const key = `${scriptId}_${batchNumber}`;
    const selectedId = state.batchImages[key];

    let html = `
        <div class="batch-image-selector">
            <div class="batch-image-header">
                <span class="batch-image-title">Imagem para este batch:</span>
            </div>
            <div class="batch-image-mini-grid">
    `;

    // Note: Images will be loaded asynchronously
    state.avatars.forEach(avatar => {
        html += `
            <div class="batch-image-mini-item ${selectedId === avatar.id ? 'selected' : ''}"
                 onclick="selectBatchImage('${scriptId}', ${batchNumber}, '${avatar.id}')"
                 data-avatar-id="${avatar.id}">
                <img src="" alt="${avatar.name}" data-load-avatar="${avatar.id}">
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    // Load avatar images after render
    setTimeout(async () => {
        const imgs = document.querySelectorAll('[data-load-avatar]');
        for (const img of imgs) {
            const avatarId = img.dataset.loadAvatar;
            const imgData = await eel.get_avatar_image_base64(avatarId)();
            if (imgData.success) {
                img.src = imgData.data;
            }
        }
    }, 100);

    return html;
}

function selectBatchImage(scriptId, batchNumber, avatarId) {
    const key = `${scriptId}_${batchNumber}`;
    state.batchImages[key] = avatarId;

    if (state.previewData) {
        renderPreview(state.previewData);
    }
}

function updateVoiceSelection(scriptIdx, voice) {
    state.voiceSelections[scriptIdx] = voice;
}

// ============================================================================
// BATCH VIDEO GENERATION
// ============================================================================

async function generateBatchVideos() {
    if (!state.previewData) {
        showMessage('statusMessages', 'Gere o preview primeiro', 'error');
        return;
    }

    const provider = document.getElementById('multiProvider').value;
    const model = document.getElementById('multiModel').value;
    const workers = parseInt(document.getElementById('multiWorkers').value);

    let imagePaths = [];
    let batchImagesMap = {};

    if (state.batchImageMode === 'fixed') {
        if (state.selectedAvatarPath) {
            imagePaths = [state.selectedAvatarPath];
        } else if (state.multiImages.length > 0) {
            imagePaths = await uploadImages(state.multiImages);
        }
    } else {
        const uniqueAvatarPaths = new Set();

        for (const [key, avatarId] of Object.entries(state.batchImages)) {
            const avatar = state.avatars.find(a => a.id === avatarId);
            if (avatar) {
                batchImagesMap[key] = avatar.image_path;
                uniqueAvatarPaths.add(avatar.image_path);
            }
        }

        let allBatchesHaveImages = true;
        state.previewData.scripts.forEach(script => {
            script.batches.forEach(batch => {
                const key = `${script.id}_${batch.batch_number}`;
                if (!batchImagesMap[key]) {
                    allBatchesHaveImages = false;
                }
            });
        });

        if (!allBatchesHaveImages) {
            showMessage('statusMessages', 'Selecione uma imagem para cada batch no modo individual', 'error');
            return;
        }

        imagePaths = Array.from(uniqueAvatarPaths);
    }

    if (imagePaths.length === 0) {
        showMessage('statusMessages', 'Selecione pelo menos uma imagem', 'error');
        return;
    }

    if (state.voiceSelections.some(v => !v)) {
        showMessage('statusMessages', 'Selecione uma voz para cada roteiro', 'error');
        return;
    }

    document.querySelector('[data-tab="loading"]').click();

    state.previewData.scripts.forEach(script => {
        addToLoadingTab({
            id: `batch_${script.id}`,
            title: `Roteiro ${script.id}`,
            text: script.text.substring(0, 100) + '...',
            status: 'processing'
        });
    });

    try {
        const data = await eel.generate_batch_videos({
            scripts: state.previewData.scripts,
            provider,
            model_id: model,
            image_paths: imagePaths,
            max_workers: workers,
            voice_selections: state.voiceSelections,
            batch_image_mode: state.batchImageMode,
            batch_images: batchImagesMap
        })();

        if (data.success) {
            const resultsCard = document.getElementById('multiResultsCard');
            const resultsContainer = document.getElementById('multiResults');

            let html = '<div class="results-grid">';

            data.results.forEach(result => {
                if (result.success) {
                    html += `
                        <div class="status-message status-success">
                            <strong>Roteiro ${result.script_id}:</strong>
                            Gerado em ${result.duration.toFixed(1)}s
                            <button class="btn btn-secondary" onclick="downloadVideoByPath('${result.video_path}')" style="margin-left: 1rem;">
                                Baixar
                            </button>
                        </div>
                    `;
                    updateLoadingTabItem(`batch_${result.script_id}`, 'completed', result.video_path);
                } else {
                    html += `
                        <div class="status-message status-error">
                            <strong>Roteiro ${result.script_id}:</strong> ${result.error}
                        </div>
                    `;
                    updateLoadingTabItem(`batch_${result.script_id}`, 'failed');
                }
            });

            html += '</div>';

            resultsCard.style.display = 'block';
            resultsContainer.innerHTML = html;

            showMessage('statusMessages', `${data.videos_count} de ${data.total_scripts} videos gerados`, 'success');

            loadVideoHistory();
            loadProcessingJobs();
        } else {
            showMessage('statusMessages', data.error, 'error');
        }
    } catch (error) {
        showMessage('statusMessages', 'Erro ao gerar videos', 'error');
        console.error(error);
    }
}

// ============================================================================
// LOADING TAB
// ============================================================================

function addToLoadingTab(item) {
    const container = document.getElementById('loadingVideosContainer');

    const emptyState = container.querySelector('.empty-state-large');
    if (emptyState) {
        emptyState.remove();
    }

    const itemHtml = `
        <div class="loading-video-card" data-id="${item.id}">
            <div class="loading-video-preview">
                <div class="loading-animation">
                    <div class="loading-spinner"></div>
                </div>
            </div>
            <div class="loading-video-info">
                <div class="loading-video-title">${item.title}</div>
                <div class="loading-video-meta">${item.text}</div>
                <div class="loading-video-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 30%;"></div>
                    </div>
                    <div class="loading-video-status">
                        Processando
                        <div class="processing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('afterbegin', itemHtml);
}

function updateLoadingTabItem(itemId, status, videoPath = null) {
    const item = document.querySelector(`.loading-video-card[data-id="${itemId}"]`);
    if (!item) return;

    if (status === 'completed' && videoPath) {
        item.remove();
        addToCompletedVideos({
            id: itemId,
            path: videoPath,
            name: videoPath.split('/').pop().split('\\').pop()
        });
    } else if (status === 'failed') {
        item.querySelector('.loading-video-status').innerHTML = `
            <span style="color: var(--error);">Falhou</span>
        `;
        item.querySelector('.progress-fill').style.background = 'var(--error)';
    }
}

async function addToCompletedVideos(video) {
    const container = document.getElementById('completedVideosContainer');

    const emptyState = container.querySelector('.empty-state-large');
    if (emptyState) {
        emptyState.remove();
    }

    const itemHtml = `
        <div class="completed-video-card">
            <div class="completed-video-thumbnail">
                <div class="completed-video-play-overlay">
                    <div class="completed-video-play-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                    </div>
                </div>
            </div>
            <div class="completed-video-info">
                <div class="completed-video-title">${video.name}</div>
                <div class="completed-video-meta">Concluido agora</div>
            </div>
            <div class="completed-video-actions">
                <button class="btn btn-primary" onclick="downloadVideoByPath('${video.path}')">
                    Baixar
                </button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('afterbegin', itemHtml);
}

async function loadProcessingJobs() {
    try {
        const data = await eel.get_jobs('processing')();

        if (data.success) {
            state.processingJobs = data.jobs;
        }
    } catch (error) {
        console.error('Erro ao carregar jobs:', error);
    }
}

// ============================================================================
// VIDEO HISTORY
// ============================================================================

async function loadVideoHistory() {
    const container = document.getElementById('videoHistoryGrid');
    if (!container) return;

    try {
        const data = await eel.get_video_history()();

        if (data.success && data.videos.length > 0) {
            container.innerHTML = data.videos.map(video => `
                <div class="video-history-item">
                    <div class="video-history-thumb-placeholder">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M23 7l-7 5 7 5V7z"></path>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                    </div>
                    <div class="video-history-info">
                        <div class="video-history-name">${video.name}</div>
                        <div class="video-history-meta">${formatFileSize(video.size)} | ${formatDate(video.created_at * 1000)}</div>
                    </div>
                    <div class="video-history-actions">
                        <button class="btn btn-secondary" onclick="playVideo('${video.path}')">Assistir</button>
                        <button class="btn btn-primary" onclick="downloadVideoByPath('${video.path}')">Baixar</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="empty-state-large" style="grid-column: 1/-1;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                        <line x1="7" y1="2" x2="7" y2="22"></line>
                        <line x1="17" y1="2" x2="17" y2="22"></line>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                    </svg>
                    <p>Nenhum video no historico</p>
                    <p class="hint">Os videos gerados aparecerão aqui</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erro ao carregar historico:', error);
    }
}

async function playVideo(videoPath) {
    try {
        const videoData = await eel.get_video_base64(videoPath)();

        if (videoData.success) {
            // Create a modal to play the video
            const modal = document.createElement('div');
            modal.className = 'video-modal';
            modal.innerHTML = `
                <div class="video-modal-overlay" onclick="this.parentElement.remove()"></div>
                <div class="video-modal-content">
                    <button class="video-modal-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
                    <video controls autoplay src="${videoData.data}"></video>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            showMessage('statusMessages', 'Erro ao carregar video', 'error');
        }
    } catch (error) {
        console.error('Erro ao reproduzir video:', error);
    }
}

// ============================================================================
// DOWNLOAD
// ============================================================================

function downloadVideo() {
    if (state.currentVideoPath) {
        downloadVideoByPath(state.currentVideoPath);
    }
}

async function downloadVideoByPath(videoPath) {
    try {
        const videoData = await eel.get_video_base64(videoPath)();

        if (videoData.success) {
            // Create download link
            const link = document.createElement('a');
            link.href = videoData.data;
            link.download = videoData.filename || 'video.mp4';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showMessage('statusMessages', 'Download iniciado!', 'success');
        } else {
            showMessage('statusMessages', 'Erro ao baixar video', 'error');
        }
    } catch (error) {
        console.error('Download error:', error);
        showMessage('statusMessages', 'Erro ao baixar video', 'error');
    }
}

async function openVideoFolder() {
    try {
        await eel.open_video_folder()();
    } catch (error) {
        console.error('Erro ao abrir pasta:', error);
    }
}

// ============================================================================
// PROJECTS
// ============================================================================

async function loadProjects() {
    try {
        const data = await eel.get_projects()();

        if (data.success) {
            state.projects = data.projects;
            renderProjects();
            renderSidebarProjects();
        }
    } catch (error) {
        console.error('Erro ao carregar projetos:', error);
    }
}

function renderProjects() {
    const container = document.getElementById('projectsList');
    if (!container) return;

    if (state.projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state-large">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <p>Nenhum projeto criado</p>
                <p class="hint">Crie projetos para organizar seus videos</p>
            </div>
        `;
        return;
    }

    container.innerHTML = state.projects.map(project => `
        <div class="project-card" data-id="${project.id}">
            <div class="project-header">
                <div>
                    <div class="project-title">${project.name}</div>
                    ${project.description ? `<div class="project-description">${project.description}</div>` : ''}
                </div>
                <div class="project-actions">
                    <button class="btn-icon" onclick="deleteProjectHandler('${project.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="project-tags">
                ${(project.tags || []).map(tag => `<span class="tag-badge">${tag}</span>`).join('')}
            </div>
            <div class="project-stats">
                <div class="project-stat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 7l-7 5 7 5V7z"></path>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>
                    ${(project.videos || []).length} videos
                </div>
                <div class="project-stat">
                    ${formatDate(project.created_at)}
                </div>
            </div>
        </div>
    `).join('');
}

function renderSidebarProjects() {
    const container = document.getElementById('sidebarProjects');
    if (!container) return;

    if (state.projects.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum projeto ainda</p>';
        return;
    }

    container.innerHTML = state.projects.map(project => `
        <div class="project-item" data-id="${project.id}" onclick="selectProject('${project.id}')">
            <div class="project-name">${project.name}</div>
            <div class="project-meta">${(project.videos || []).length} videos</div>
        </div>
    `).join('');
}

async function deleteProjectHandler(projectId) {
    if (!confirm('Tem certeza que deseja excluir este projeto?')) return;

    try {
        const data = await eel.delete_project(projectId)();

        if (data.success) {
            loadProjects();
        } else {
            alert('Erro ao excluir projeto: ' + data.error);
        }
    } catch (error) {
        console.error('Erro ao excluir projeto:', error);
    }
}

function selectProject(projectId) {
    state.currentProject = projectId;
    document.querySelectorAll('.project-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === projectId);
    });
}

// ============================================================================
// UTILITIES
// ============================================================================

function showMessage(containerId, message, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const div = document.createElement('div');
    div.className = `status-message status-${type}`;
    div.textContent = message;
    container.appendChild(div);

    setTimeout(() => div.remove(), 5000);
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Make functions globally accessible
window.toggleImageSource = toggleImageSource;
window.setBatchImageMode = setBatchImageMode;
window.selectAvatar = selectAvatar;
window.selectAvatarForUse = selectAvatarForUse;
window.deleteAvatar = deleteAvatar;
window.cancelAvatarUpload = cancelAvatarUpload;
window.saveAvatar = saveAvatar;
window.removeImage = removeImage;
window.updateVoiceSelection = updateVoiceSelection;
window.generateBatchVideos = generateBatchVideos;
window.selectBatchImage = selectBatchImage;
window.downloadVideoByPath = downloadVideoByPath;
window.playVideo = playVideo;
window.loadVideoHistory = loadVideoHistory;
window.loadProcessingJobs = loadProcessingJobs;
window.selectProject = selectProject;
window.deleteProjectHandler = deleteProjectHandler;
window.openVideoFolder = openVideoFolder;
