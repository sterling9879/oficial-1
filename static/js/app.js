// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const AppState = {
    singleImages: [],
    multiImages: [],
    previewData: null,
    currentVideoPath: null,
    apiKeysConfigured: {
        elevenlabs: false,
        minimax: false,
        gemini: false,
        wavespeed: false
    }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Check API keys status
    checkApiKeysStatus();

    // Initialize event listeners
    initSettingsModal();
    initTabs();
    initSingleVideoTab();
    initMultiScriptsTab();

    // Initialize new features
    initProjectsManagement();
    initAvatarsManagement();
    initJobsTimeline();
    loadVideoHistory();

    console.log('✅ Application initialized');
}

// ============================================================================
// API KEYS CONFIGURATION
// ============================================================================

async function checkApiKeysStatus() {
    try {
        const response = await fetch('/api/config/keys');
        const data = await response.json();

        if (data.success) {
            AppState.apiKeysConfigured = data.keys;
            updateApiStatusBadges();
        }
    } catch (error) {
        console.error('Error checking API keys:', error);
    }
}

function updateApiStatusBadges() {
    const badges = {
        elevenlabs: document.getElementById('statusElevenlabs'),
        minimax: document.getElementById('statusMinimax'),
        gemini: document.getElementById('statusGemini'),
        wavespeed: document.getElementById('statusWavespeed')
    };

    for (const [key, element] of Object.entries(badges)) {
        if (AppState.apiKeysConfigured[key]) {
            element.textContent = '✓ Configurada';
            element.className = 'api-status configured';
        } else {
            element.textContent = '⚠ Não configurada';
            element.className = 'api-status not-configured';
        }
    }
}

function initSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const btnOpen = document.getElementById('btnOpenSettings');
    const btnClose = document.getElementById('btnCloseSettings');
    const btnCancel = document.getElementById('btnCancelSettings');
    const btnSave = document.getElementById('btnSaveSettings');
    const overlay = document.getElementById('modalOverlay');

    btnOpen.addEventListener('click', () => {
        modal.classList.add('active');
    });

    const closeModal = () => {
        modal.classList.remove('active');
    };

    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    btnSave.addEventListener('click', saveApiKeys);
}

async function saveApiKeys() {
    const keys = {
        elevenlabs_api_key: document.getElementById('apiKeyElevenlabs').value,
        minimax_api_key: document.getElementById('apiKeyMinimax').value,
        gemini_api_key: document.getElementById('apiKeyGemini').value,
        wavespeed_api_key: document.getElementById('apiKeyWavespeed').value
    };

    try {
        const response = await fetch('/api/config/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(keys)
        });

        const data = await response.json();

        if (data.success) {
            showStatusMessage('success', data.message);
            document.getElementById('settingsModal').classList.remove('active');
            await checkApiKeysStatus();

            // Reload voices for current provider
            const provider = document.getElementById('singleProvider').value;
            await loadVoices('singleVoice', provider);
        } else {
            showStatusMessage('error', data.error);
        }
    } catch (error) {
        showStatusMessage('error', `Erro ao salvar API keys: ${error.message}`);
    }
}

// ============================================================================
// TABS
// ============================================================================

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // Update active states
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });
}

// ============================================================================
// SINGLE VIDEO TAB
// ============================================================================

function initSingleVideoTab() {
    // Provider change
    const providerSelect = document.getElementById('singleProvider');
    providerSelect.addEventListener('change', async (e) => {
        await loadVoices('singleVoice', e.target.value);
    });

    // Load initial voices
    loadVoices('singleVoice', providerSelect.value);

    // Image upload
    const uploadArea = document.getElementById('singleUploadArea');
    const fileInput = document.getElementById('singleImages');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--accent-primary)';
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = 'var(--border-color)';
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--border-color)';
        handleImageUpload(e.dataTransfer.files, 'single');
    });

    fileInput.addEventListener('change', (e) => {
        handleImageUpload(e.target.files, 'single');
    });

    // Slider
    const workersSlider = document.getElementById('singleWorkers');
    const workersValue = document.getElementById('singleWorkersValue');
    workersSlider.addEventListener('input', (e) => {
        workersValue.textContent = e.target.value;
    });

    // Buttons
    document.getElementById('btnEstimate').addEventListener('click', estimateJob);
    document.getElementById('btnGenerate').addEventListener('click', generateSingleVideo);
}

async function loadVoices(selectId, provider) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Carregando vozes...</option>';

    try {
        const response = await fetch(`/api/voices/${provider}`);
        const data = await response.json();

        if (data.success) {
            select.innerHTML = data.voices.map(voice =>
                `<option value="${voice}">${voice}</option>`
            ).join('');
        } else {
            select.innerHTML = '<option value="">Erro ao carregar vozes</option>';
            showStatusMessage('error', data.error);
        }
    } catch (error) {
        select.innerHTML = '<option value="">Erro de conexão</option>';
        console.error('Error loading voices:', error);
    }
}

function handleImageUpload(files, mode) {
    const fileArray = Array.from(files);
    const validImages = fileArray.filter(file => file.type.startsWith('image/'));

    if (mode === 'single') {
        AppState.singleImages = validImages;
        displayImagePreviews('singleImagePreview', validImages);
    } else {
        AppState.multiImages = validImages;
        displayImagePreviews('multiImagePreview', validImages);
    }
}

function displayImagePreviews(containerId, images) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    images.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'image-preview-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="Preview ${index + 1}">
                <button class="image-preview-remove" onclick="removeImage('${containerId.replace('Preview', '')}', ${index})">×</button>
            `;
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removeImage(mode, index) {
    if (mode === 'singleImage') {
        AppState.singleImages.splice(index, 1);
        displayImagePreviews('singleImagePreview', AppState.singleImages);
    } else {
        AppState.multiImages.splice(index, 1);
        displayImagePreviews('multiImagePreview', AppState.multiImages);
    }
}

async function estimateJob() {
    const text = document.getElementById('singleText').value;

    if (!text.trim()) {
        showStatusMessage('error', 'Por favor, digite um roteiro');
        return;
    }

    try {
        const response = await fetch('/api/estimate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        const data = await response.json();

        if (data.success) {
            displayEstimate(data.estimate);
        } else {
            showStatusMessage('error', data.error);
        }
    } catch (error) {
        showStatusMessage('error', `Erro ao calcular estimativa: ${error.message}`);
    }
}

function displayEstimate(estimate) {
    const card = document.getElementById('estimateCard');
    const content = document.getElementById('estimateContent');

    content.innerHTML = `
        <p><strong>Análise do Texto:</strong></p>
        <ul>
            <li>Caracteres: ${estimate.num_chars.toLocaleString()}</li>
            <li>Batches: ${estimate.num_batches}</li>
            <li>Vídeos a gerar: ${estimate.num_videos}</li>
        </ul>
        
        <p><strong>Tempo Estimado:</strong> ${estimate.estimated_time}</p>
        
        <p><strong>Custo Estimado:</strong></p>
        <ul>
            <li>Gemini: ${estimate.estimated_cost.gemini}</li>
            <li>ElevenLabs: ${estimate.estimated_cost.elevenlabs}</li>
            <li>WaveSpeed: ${estimate.estimated_cost.wavespeed}</li>
            <li><strong>Total: ${estimate.estimated_cost.total}</strong></li>
        </ul>
        
        <p style="color: var(--text-muted); font-size: 0.875rem; margin-top: 1rem;">
            Os valores são aproximados e podem variar conforme uso real das APIs.
        </p>
    `;

    card.style.display = 'block';
}

async function generateSingleVideo() {
    const text = document.getElementById('singleText').value;
    const provider = document.getElementById('singleProvider').value;
    const voiceName = document.getElementById('singleVoice').value;
    const modelId = document.getElementById('singleModel').value;
    const maxWorkers = parseInt(document.getElementById('singleWorkers').value);

    // Validation
    if (!text.trim()) {
        showStatusMessage('error', 'Por favor, digite um roteiro');
        return;
    }

    if (!voiceName) {
        showStatusMessage('error', 'Por favor, selecione uma voz');
        return;
    }

    if (AppState.singleImages.length === 0) {
        showStatusMessage('error', 'Por favor, faça upload de pelo menos uma imagem');
        return;
    }

    // Upload images first
    showProgress('Fazendo upload das imagens...', 10);

    try {
        const imagePaths = await uploadImages(AppState.singleImages);

        // Generate video
        showProgress('Iniciando geração do vídeo...', 20);

        const response = await fetch('/api/generate/single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                provider,
                voice_name: voiceName,
                model_id: modelId,
                image_paths: imagePaths,
                max_workers: maxWorkers
            })
        });

        const data = await response.json();

        if (data.success) {
            showProgress('Vídeo gerado com sucesso!', 100);
            displayVideo(data.video_path);
            showStatusMessage('success', `Vídeo gerado em ${data.duration.toFixed(1)}s - Job ID: ${data.job_id}`);
        } else {
            hideProgress();
            showStatusMessage('error', data.error);
        }
    } catch (error) {
        hideProgress();
        showStatusMessage('error', `Erro ao gerar vídeo: ${error.message}`);
    }
}

async function uploadImages(images) {
    const formData = new FormData();
    images.forEach(image => {
        formData.append('images', image);
    });

    const response = await fetch('/api/upload/images', {
        method: 'POST',
        body: formData
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error);
    }

    return data.paths;
}

// ============================================================================
// MULTI SCRIPTS TAB
// ============================================================================

function initMultiScriptsTab() {
    // Provider change
    const providerSelect = document.getElementById('multiProvider');
    providerSelect.addEventListener('change', async (e) => {
        // We'll load voices dynamically per script
    });

    // Image upload
    const uploadArea = document.getElementById('multiUploadArea');
    const fileInput = document.getElementById('multiImages');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--accent-primary)';
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = 'var(--border-color)';
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--border-color)';
        handleImageUpload(e.dataTransfer.files, 'multi');
    });

    fileInput.addEventListener('change', (e) => {
        handleImageUpload(e.target.files, 'multi');
    });

    // Slider
    const workersSlider = document.getElementById('multiWorkers');
    const workersValue = document.getElementById('multiWorkersValue');
    workersSlider.addEventListener('input', (e) => {
        workersValue.textContent = e.target.value;
    });

    // Button
    document.getElementById('btnGeneratePreview').addEventListener('click', generatePreview);
}

async function generatePreview() {
    const scriptsText = document.getElementById('multiText').value;

    if (!scriptsText.trim()) {
        showStatusMessage('error', 'Por favor, digite os roteiros');
        return;
    }

    if (AppState.multiImages.length === 0) {
        showStatusMessage('error', 'Por favor, faça upload de pelo menos uma imagem');
        return;
    }

    try {
        const response = await fetch('/api/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scripts_text: scriptsText })
        });

        const data = await response.json();

        if (data.success) {
            AppState.previewData = data;
            await displayPreview(data);
            showStatusMessage('success', `${data.summary.total_scripts} roteiros encontrados com ${data.summary.total_batches} batches`);
        } else {
            showStatusMessage('error', data.error);
        }
    } catch (error) {
        showStatusMessage('error', `Erro ao gerar preview: ${error.message}`);
    }
}

async function displayPreview(data) {
    const container = document.getElementById('previewContent');
    const provider = document.getElementById('multiProvider').value;

    // Load voices for provider
    const voicesResponse = await fetch(`/api/voices/${provider}`);
    const voicesData = await voicesResponse.json();
    const voices = voicesData.success ? voicesData.voices : [];

    let html = '';

    data.scripts.forEach((script, scriptIdx) => {
        html += `
            <div class="script-card" data-script-id="${script.id}">
                <div class="script-header">
                    <div>
                        <div class="script-title">Roteiro #${script.id}</div>
                        <div class="script-stats">${script.total_chars.toLocaleString()} caracteres | ${script.total_batches} batches</div>
                    </div>
                    <span class="info-badge">Selecione a voz</span>
                </div>
                
                <div class="form-group">
                    <label>Voz para este roteiro:</label>
                    <select class="select script-voice" data-script-index="${scriptIdx}">
                        ${voices.map(v => `<option value="${v}">${v}</option>`).join('')}
                    </select>
                </div>
        `;

        script.batches.forEach(batch => {
            const previewText = batch.text.length > 200 ? batch.text.substring(0, 200) + '...' : batch.text;

            html += `
                <div class="batch-card">
                    <div class="batch-header">
                        <span class="batch-title">Batch #${batch.batch_number}</span>
                        <span class="info-badge">${batch.char_count} caracteres</span>
                    </div>
                    <div class="batch-text">${previewText}</div>
                </div>
            `;
        });

        html += `</div>`;
    });

    html += `
        <button class="btn btn-primary btn-block" onclick="processBatchVideos()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Processar Todos os Roteiros
        </button>
    `;

    container.innerHTML = html;
}

async function processBatchVideos() {
    if (!AppState.previewData) {
        showStatusMessage('error', 'Gere o preview primeiro');
        return;
    }

    const provider = document.getElementById('multiProvider').value;
    const modelId = document.getElementById('multiModel').value;
    const maxWorkers = parseInt(document.getElementById('multiWorkers').value);

    // Get voice selections
    const voiceSelects = document.querySelectorAll('.script-voice');
    const voiceSelections = Array.from(voiceSelects).map(select => select.value);

    // Upload images
    showProgress('Fazendo upload das imagens...', 5);

    try {
        const imagePaths = await uploadImages(AppState.multiImages);

        showProgress('Processando roteiros...', 10);

        const response = await fetch('/api/generate/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scripts: AppState.previewData.scripts,
                provider,
                model_id: modelId,
                image_paths: imagePaths,
                max_workers: maxWorkers,
                voice_selections: voiceSelections
            })
        });

        const data = await response.json();

        if (data.success) {
            showProgress('Processamento concluído!', 100);
            displayBatchResults(data);
        } else {
            hideProgress();
            showStatusMessage('error', data.error);
        }
    } catch (error) {
        hideProgress();
        showStatusMessage('error', `Erro ao processar lote: ${error.message}`);
    }
}

function displayBatchResults(data) {
    const card = document.getElementById('multiResultsCard');
    const container = document.getElementById('multiResults');

    let html = `
        <div class="status-message status-success">
            <strong>Processamento Concluído!</strong><br>
            ${data.videos_count} de ${data.total_scripts} roteiros foram processados com sucesso
        </div>
    `;

    data.results.forEach(result => {
        if (result.success) {
            html += `
                <div class="status-message status-success">
                    ✓ Roteiro #${result.script_id}: Concluído em ${result.duration.toFixed(1)}s<br>
                    <small>${result.video_path}</small>
                </div>
            `;
        } else {
            html += `
                <div class="status-message status-error">
                    ✗ Roteiro #${result.script_id}: ${result.error}
                </div>
            `;
        }
    });

    container.innerHTML = html;
    card.style.display = 'block';
}

// ============================================================================
// UI HELPERS
// ============================================================================

function showProgress(message, percent) {
    const container = document.getElementById('progressContainer');
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');

    container.style.display = 'block';
    fill.style.width = `${percent}%`;
    text.textContent = message;
}

function hideProgress() {
    document.getElementById('progressContainer').style.display = 'none';
}

function showStatusMessage(type, message) {
    const container = document.getElementById('statusMessages');
    const div = document.createElement('div');
    div.className = `status-message status-${type}`;
    div.textContent = message;

    container.appendChild(div);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        div.remove();
    }, 5000);
}

function displayVideo(videoPath) {
    const container = document.getElementById('videoContainer');
    const player = document.getElementById('videoPlayer');
    const btnDownload = document.getElementById('btnDownload');

    AppState.currentVideoPath = videoPath;
    player.src = `/api/download/${encodeURIComponent(videoPath)}`;
    container.style.display = 'block';

    btnDownload.onclick = () => {
        window.open(`/api/download/${encodeURIComponent(videoPath)}`, '_blank');
    };
}

// ============================================================================
// PROJECTS MANAGEMENT
// ============================================================================

let selectedProjectId = null;
let selectedTag = '';

function initProjectsManagement() {
    loadProjects();
    loadTags();

    // New project button in sidebar
    document.getElementById('btnNewProject')?.addEventListener('click', showNewProjectModal);

    // New project button in projects tab
    document.getElementById('btnNewProjectTab')?.addEventListener('click', showNewProjectModal);

    // Manage tags button
    document.getElementById('btnManageTags')?.addEventListener('click', showManageTagsModal);
}

async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const data = await response.json();

        if (data.success) {
            displayProjectsInSidebar(data.projects);
            displayProjectsInTab(data.projects);
        }
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

async function loadTags() {
    try {
        const response = await fetch('/api/tags');
        const data = await response.json();

        if (data.success) {
            displayTagsInSidebar(data.tags);
        }
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

function displayProjectsInSidebar(projects) {
    const container = document.getElementById('sidebarProjects');

    if (projects.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum projeto ainda</p>';
        return;
    }

    const filtered = selectedTag ? projects.filter(p => p.tags.includes(selectedTag)) : projects;

    container.innerHTML = filtered.map(project => `
        <div class="project-item ${project.id === selectedProjectId ? 'active' : ''}" 
             onclick="selectProject('${project.id}')">
            <div class="project-name">${project.name}</div>
            <div class="project-meta">${project.videos?.length || 0} vídeos</div>
        </div>
    `).join('');
}

function displayProjectsInTab(projects) {
    const container = document.getElementById('projectsList');

    if (projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state-large">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <p>Nenhum projeto criado</p>
                <p class="hint">Crie projetos para organizar seus vídeos</p>
            </div>
        `;
        return;
    }

    container.innerHTML = projects.map(project => `
        <div class="project-card">
            <div class="project-header">
                <div>
                    <div class="project-title">${project.name}</div>
                    <div class="project-description">${project.description || ''}</div>
                </div>
                <div class="project-actions">
                    <button class="btn-icon" onclick="editProject('${project.id}')" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon" onclick="deleteProject('${project.id}')" title="Deletar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="project-tags">
                ${project.tags.map(tag => `<span class="tag-badge">${tag}</span>`).join('')}
            </div>
            <div class="project-stats">
                <div class="project-stat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 7l-7 5 7 5V7z"></path>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>
                    ${project.videos?.length || 0} vídeos
                </div>
                <div class="project-stat">Criado em ${new Date(project.created_at).toLocaleDateString()}</div>
            </div>
        </div>
    `).join('');
}

function displayTagsInSidebar(tags) {
    const container = document.getElementById('sidebarTags');

    container.innerHTML = `
        <div class="tag-badge ${!selectedTag ? 'active' : ''}" onclick="filterByTag('')">Todos</div>
        ${tags.map(tag => `
            <div class="tag-badge ${selectedTag === tag.name ? 'active' : ''}" 
                 onclick="filterByTag('${tag.name}')">${tag.name}</div>
        `).join('')}
    `;
}

function filterByTag(tag) {
    selectedTag = tag;
    loadProjects();
    loadTags();
}

function selectProject(projectId) {
    selectedProjectId = projectId;
    loadProjects();
}

function showNewProjectModal() {
    // Simple prompt for now - can be replaced with custom modal
    const name = prompt('Nome do projeto:');
    if (!name) return;

    const description = prompt('Descrição (opcional):');
    const tagsStr = prompt('Tags (separe por vírgula):');
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : [];

    createProject({ name, description, tags });
}

async function createProject(projectData) {
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        });

        const data = await response.json();

        if (data.success) {
            showStatusMessage('success', 'Projeto criado com sucesso!');
            loadProjects();
            loadTags();
        } else {
            showStatusMessage('error', data.error);
        }
    } catch (error) {
        showStatusMessage('error', `Erro ao criar projeto: ${error.message}`);
    }
}

async function deleteProject(projectId) {
    if (!confirm('Tem certeza que deseja deletar este projeto?')) return;

    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showStatusMessage('success', 'Projeto deletado!');
            loadProjects();
        } else {
            showStatusMessage('error', data.error);
        }
    } catch (error) {
        showStatusMessage('error', `Erro ao deletar projeto: ${error.message}`);
    }
}

function showManageTagsModal() {
    const newTag = prompt('Nome da nova tag:');
    if (!newTag) return;

    createTag(newTag);
}

async function createTag(tagName) {
    try {
        const response = await fetch('/api/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag_name: tagName })
        });

        const data = await response.json();

        if (data.success) {
            showStatusMessage('success', 'Tag criada!');
            loadTags();
        } else {
            showStatusMessage('error', data.error);
        }
    } catch (error) {
        showStatusMessage('error', `Erro ao criar tag: ${error.message}`);
    }
}

// ============================================================================
// AVATARS MANAGEMENT
// ============================================================================

function initAvatarsManagement() {
    loadAvatars();

    const btnUpload = document.getElementById('btnUploadAvatar');
    const fileInput = document.getElementById('avatarUploadInput');

    btnUpload?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', (e) => uploadAvatar(e.target.files[0]));
}

async function loadAvatars() {
    try {
        const response = await fetch('/api/avatars');
        const data = await response.json();

        if (data.success) {
            displayAvatarsGallery(data.avatars);
        }
    } catch (error) {
        console.error('Error loading avatars:', error);
    }
}

function displayAvatarsGallery(avatars) {
    const container = document.getElementById('avatarsGallery');

    if (avatars.length === 0) {
        container.innerHTML = `
            <div class="empty-state-large">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <p>Nenhum avatar salvo ainda</p>
                <p class="hint">Faça upload de imagens template para usar nos vídeos</p>
            </div>
        `;
        return;
    }

    container.innerHTML = avatars.map(avatar => `
        <div class="avatar-item">
            <img class="avatar-image" src="/api/avatars/${avatar.id}/image" alt="${avatar.name}">
            <div class="avatar-info">
                <div class="avatar-name">${avatar.name}</div>
                <div class="avatar-date">${new Date(avatar.created_at).toLocaleDateString()}</div>
                <div class="avatar-actions">
                    <button class="btn-avatar-action" onclick="useAvatar('${avatar.id}')">Usar</button>
                    <button class="btn-avatar-action" onclick="deleteAvatar('${avatar.id}')">Deletar</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function uploadAvatar(file) {
    if (!file) return;

    const name = prompt('Nome para este avatar:');
    if (!name) return;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('name', name);

    try {
        const response = await fetch('/api/avatars', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showStatusMessage('success', 'Avatar criado com sucesso!');
            loadAvatars();
        } else {
            showStatusMessage('error', data.error);
        }
    } catch (error) {
        showStatusMessage('error', `Erro ao fazer upload: ${error.message}`);
    }
}

async function deleteAvatar(avatarId) {
    if (!confirm('Deletar este avatar?')) return;

    try {
        const response = await fetch(`/api/avatars/${avatarId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showStatusMessage('success', 'Avatar deletado!');
            loadAvatars();
        } else {
            showStatusMessage('error', data.error);
        }
    } catch (error) {
        showStatusMessage('error', `Erro ao deletar avatar: ${error.message}`);
    }
}

function useAvatar(avatarId) {
    showStatusMessage('info', 'Avatar selecionado! Use na geração de vídeos.');
    // TODO: Integrate with video generation
}

// ============================================================================
// JOBS TIMELINE
// ============================================================================

let jobsRefreshInterval = null;

function initJobsTimeline() {
    loadJobs();

    // Refresh button
    document.getElementById('btnRefreshJobs')?.addEventListener('click', loadJobs);

    // Auto-refresh every 5 seconds when on jobs tab
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-tab="jobs"]')) {
            startJobsAutoRefresh();
        } else if (e.target.closest('.tab-btn') && !e.target.closest('[data-tab="jobs"]')) {
            stopJobsAutoRefresh();
        }
    });
}

function startJobsAutoRefresh() {
    if (jobsRefreshInterval) return;
    jobsRefreshInterval = setInterval(loadJobs, 5000);
}

function stopJobsAutoRefresh() {
    if (jobsRefreshInterval) {
        clearInterval(jobsRefreshInterval);
        jobsRefreshInterval = null;
    }
}

async function loadJobs() {
    try {
        const response = await fetch('/api/jobs');
        const data = await response.json();

        if (data.success) {
            displayJobsTimeline(data.jobs);
        }
    } catch (error) {
        console.error('Error loading jobs:', error);
    }
}

function displayJobsTimeline(jobs) {
    const container = document.getElementById('jobsTimeline');

    if (jobs.length === 0) {
        container.innerHTML = `
            <div class="empty-state-large">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <p>Nenhum job em processamento</p>
            </div>
        `;
        return;
    }

    // Sort by date, newest first
    jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    container.innerHTML = jobs.map(job => `
        <div class="job-item">
            <div class="job-header">
                <div class="job-title">${job.type} - Job #${job.id}</div>
                <span class="job-status ${job.status}">${getStatusText(job.status)}</span>
            </div>
            <div class="job-info">
                <div>Criado: ${new Date(job.created_at).toLocaleString()}</div>
                ${job.video_path ? `<div>Vídeo: ${job.video_path.split('/').pop()}</div>` : ''}
            </div>
            ${job.status === 'processing' ? `
                <div class="job-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 50%"></div>
                    </div>
                </div>
            ` : ''}
            ${job.status === 'completed' && job.video_path ? `
                <div class="job-actions">
                    <button class="btn btn-secondary" onclick="downloadJobVideo('${job.video_path}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendente',
        'processing': 'Processando',
        'completed': 'Concluído',
        'failed': 'Falhou'
    };
    return statusMap[status] || status;
}

function downloadJobVideo(videoPath) {
    window.open(`/api/download/${encodeURIComponent(videoPath)}`, '_blank');
}

// Update initialization to include new features
const originalInitializeApp = window.initializeApp || initializeApp;
window.initializeApp = function () {
    originalInitializeApp();
    initProjectsManagement();
    initAvatarsManagement();
    initJobsTimeline();
};
// ============================================================================
// UI ENHANCEMENTS - AVATAR SELECTOR & IMAGE SOURCE
// ============================================================================

let currentImageSource = {
    single: 'upload', // 'upload' or 'avatar'
    multi: 'upload'
};

let selectedAvatarId = {
    single: null,
    multi: null
};

function injectAvatarSelectors() {
    // Inject for Single Video Tab
    injectAvatarSelectorInTab('single', 'singleImages');

    // Inject for Multi Scripts Tab  
    injectAvatarSelectorInTab('multi', 'multiImages');
}

function injectAvatarSelectorInTab(mode, uploadInputId) {
    const uploadInput = document.getElementById(uploadInputId);
    if (!uploadInput) return;

    const formGroup = uploadInput.closest('.form-group');
    if (!formGroup) return;

    // Check if already injected
    if (formGroup.querySelector('.image-source-toggle')) return;

    const label = formGroup.querySelector('label');

    // Create toggle buttons
    const toggle = document.createElement('div');
    toggle.className = 'image-source-toggle';
    toggle.innerHTML = `
        <button class="toggle-btn active" data-source="upload" onclick="toggleImageSource('${mode}', 'upload')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Upload Novo
        </button>
        <button class="toggle-btn" data-source="avatar" onclick="toggleImageSource('${mode}', 'avatar')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Usar Avatar
        </button>
    `;

    // Create avatar selector (hidden by default)
    const avatarSelector = document.createElement('div');
    avatarSelector.id = `${mode}AvatarSelector`;
    avatarSelector.className = 'avatar-selector';
    avatarSelector.style.display = 'none';
    avatarSelector.innerHTML = `
        <div id="${mode}AvatarGrid" class="avatar-selector-grid">
            <div class="empty-state">Carregando avatares...</div>
        </div>
    `;

    // Find upload area and wrap it
    const uploadArea = formGroup.querySelector('.upload-area');
    const uploadContainer = document.createElement('div');
    uploadContainer.id = `${mode}UploadContainer`;
    uploadContainer.className = 'upload-container';

    // Insert toggle after label
    label.after(toggle);

    // Insert avatar selector after toggle
    toggle.after(avatarSelector);

    // Move upload area into container
    if (uploadArea) {
        uploadArea.before(uploadContainer);
        uploadContainer.appendChild(uploadArea);
        const imagePreview = formGroup.querySelector(`#${mode}ImagePreview`);
        if (imagePreview) {
            uploadContainer.appendChild(imagePreview);
        }
    }

    // Load avatars for this selector
    loadAvatarsForSelector(mode);
}

function toggleImageSource(mode, source) {
    currentImageSource[mode] = source;

    // Update button states
    const formGroup = document.getElementById(`${mode}Images`)?.closest('.form-group');
    if (!formGroup) return;

    const buttons = formGroup.querySelectorAll('.toggle-btn');
    buttons.forEach(btn => {
        if (btn.dataset.source === source) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Show/hide appropriate sections
    const avatarSelector = document.getElementById(`${mode}AvatarSelector`);
    const uploadContainer = document.getElementById(`${mode}UploadContainer`);

    if (source === 'avatar') {
        if (avatarSelector) avatarSelector.style.display = 'block';
        if (uploadContainer) uploadContainer.style.display = 'none';
    } else {
        if (avatarSelector) avatarSelector.style.display = 'none';
        if (uploadContainer) uploadContainer.style.display = 'block';
    }
}

async function loadAvatarsForSelector(mode) {
    try {
        const response = await fetch('/api/avatars');
        const data = await response.json();

        const grid = document.getElementById(`${mode}AvatarGrid`);
        if (!grid) return;

        if (!data.success || data.avatars.length === 0) {
            grid.innerHTML = '<div class="empty-state">Nenhum avatar disponível. Crie um na aba "My Avatars".</div>';
            return;
        }

        grid.innerHTML = data.avatars.map(avatar => `
            <div class="avatar-selector-item" onclick="selectAvatarForMode('${mode}', '${avatar.id}')" data-avatar-id="${avatar.id}">
                <img src="/api/avatars/${avatar.id}/image" alt="${avatar.name}">
                <div class="avatar-selector-name">${avatar.name}</div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading avatars:', error);
    }
}

function selectAvatarForMode(mode, avatarId) {
    selectedAvatarId[mode] = avatarId;

    // Update visual selection
    const grid = document.getElementById(`${mode}AvatarGrid`);
    if (!grid) return;

    grid.querySelectorAll('.avatar-selector-item').forEach(item => {
        if (item.dataset.avatarId === avatarId) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// ============================================================================
// AUTO-REDIRECT TO JOBS TIMELINE
// ============================================================================

function redirectToJobsTimeline(jobId = null) {
    // Switch to jobs tab
    const jobsTabBtn = document.querySelector('[data-tab="jobs"]');
    if (jobsTabBtn) {
        jobsTabBtn.click();
    }

    // Start auto-refresh
    startJobsAutoRefresh();

    // If jobId provided, highlight it
    if (jobId) {
        setTimeout(() => highlightJob(jobId), 500);
    }
}

function highlightJob(jobId) {
    const jobItem = document.querySelector(`[data-job-id="${jobId}"]`);
    if (jobItem) {
        jobItem.style.animation = 'pulse 1s ease-in-out 3';
        jobItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ============================================================================
// VIDEO HISTORY
// ============================================================================

function createVideoHistoryModal() {
    // Check if already exists
    if (document.getElementById('videoHistoryModal')) return;

    const modal = document.createElement('div');
    modal.id = 'videoHistoryModal';
    modal.className = 'video-history-modal modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeVideoHistory()"></div>
        <div class="video-history-content">
            <div class="video-history-header">
                <h2>Histórico de Vídeos</h2>
                <button class="modal-close" onclick="closeVideoHistory()">×</button>
            </div>
            <div id="videoHistoryGrid" class="video-history-grid">
                <div class="empty-state-large">Carregando...</div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function showVideoHistory() {
    createVideoHistoryModal();
    const modal = document.getElementById('videoHistoryModal');
    modal.classList.add('active');
    loadVideoHistory();
}

function closeVideoHistory() {
    const modal = document.getElementById('videoHistoryModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function loadVideoHistory() {
    try {
        const response = await fetch('/api/videos/history');
        const data = await response.json();

        const grid = document.getElementById('videoHistoryGrid');
        if (!grid) return;

        if (!data.success || data.videos.length === 0) {
            grid.innerHTML = `
                <div class="empty-state-large">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                        <line x1="7" y1="2" x2="7" y2="22"></line>
                        <line x1="17" y1="2" x2="17" y2="22"></line>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <line x1="2" y1="7" x2="7" y2="7"></line>
                        <line x1="2" y1="17" x2="7" y2="17"></line>
                        <line x1="17" y1="17" x2="22" y2="17"></line>
                        <line x1="17" y1="7" x2="22" y2="7"></line>
                    </svg>
                    <p>Nenhum vídeo no histórico</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = data.videos.map(video => `
            <div class="video-history-card" onclick="playHistoryVideo('${video.path}')">
                <div class="video-history-thumbnail">
                    <video src="/api/download/${encodeURIComponent(video.path)}" preload="metadata"></video>
                    <div class="video-history-play-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                    </div>
                </div>
                <div class="video-history-info">
                    <div class="video-history-title">${video.filename}</div>
                    <div class="video-history-meta">
                        <span>${video.date}</span>
                        <span>${video.size}</span>
                    </div>
                </div>
                <div class="video-history-actions">
                    <button class="btn-history-action" onclick="event.stopPropagation(); downloadHistoryVideo('${video.path}')">
                        Download
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading video history:', error);
    }
}

function playHistoryVideo(videoPath) {
    displayVideo(videoPath);
    closeVideoHistory();

    // Switch to single video tab to show player
    const singleTab = document.querySelector('[data-tab="single"]');
    if (singleTab) singleTab.click();
}

function downloadHistoryVideo(videoPath) {
    window.open(`/api/download/${encodeURIComponent(videoPath)}`, '_blank');
}

// Add history button to jobs timeline
function addVideoHistoryButton() {
    const jobsCard = document.querySelector('#tab-jobs .card-header-row');
    if (!jobsCard || jobsCard.querySelector('#btnVideoHistory')) return;

    const btn = document.createElement('button');
    btn.id = 'btnVideoHistory';
    btn.className = 'btn btn-secondary';
    btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        Ver Histórico
    `;
    btn.onclick = showVideoHistory;

    const refreshBtn = document.getElementById('btnRefreshJobs');
    if (refreshBtn) {
        refreshBtn.after(btn);
    }
}

// ============================================================================
// ENHANCED JOB DISPLAY
// ============================================================================

const originalDisplayJobsTimeline = window.displayJobsTimeline;

window.displayJobsTimeline = function (jobs) {
    const container = document.getElementById('jobsTimeline');

    if (jobs.length === 0) {
        container.innerHTML = `
            <div class="empty-state-large">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <p>Nenhum job em processamento</p>
            </div>
        `;
        return;
    }

    jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    container.innerHTML = jobs.map(job => createEnhancedJobCard(job)).join('');
};

function createEnhancedJobCard(job) {
    const hasVideo = job.status === 'completed' && job.video_path;

    return `
        <div class="job-item" data-job-id="${job.id}">
            <div class="job-header">
                <div class="job-title">${job.type} - Job #${job.id}</div>
                <span class="job-status ${job.status}">${getStatusText(job.status)}</span>
            </div>
            <div class="job-info">
                <div>Criado: ${new Date(job.created_at).toLocaleString()}</div>
                ${job.video_path ? `<div>Vídeo: ${job.video_path.split('/').pop()}</div>` : ''}
            </div>
            ${job.status === 'processing' ? `
                <div class="job-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${job.progress || 50}%"></div>
                    </div>
                    <div class="job-progress-percent">${job.progress || 50}%</div>
                </div>
            ` : ''}
            ${hasVideo ? `
                <div class="job-video-preview">
                    <video src="/api/download/${encodeURIComponent(job.video_path)}" controls preload="metadata"></video>
                </div>
                <div class="job-actions">
                    <button class="btn btn-secondary" onclick="downloadJobVideo('${job.video_path}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// ============================================================================
// MODIFY VIDEO GENERATION TO AUTO-REDIRECT
// ============================================================================

const originalGenerateSingleVideo = window.generateSingleVideo;
const originalProcessBatchVideos = window.processBatchVideos;

window.generateSingleVideo = async function () {
    // Call original function
    const result = await originalGenerateSingleVideo.call(this);

    // Auto-redirect to jobs timeline
    setTimeout(() => redirectToJobsTimeline(), 500);

    return result;
};

window.processBatchVideos = async function () {
    // Call original function  
    const result = await originalProcessBatchVideos.call(this);

    // Auto-redirect to jobs timeline
    setTimeout(() => redirectToJobsTimeline(), 500);

    return result;
};

// ============================================================================
// INITIALIZATION
// ============================================================================

// Wait for DOM and original app to init
const originalInit = window.initializeApp;
window.initializeApp = function () {
    // Call original initialization
    if (originalInit) originalInit();

    // Add our enhancements
    setTimeout(() => {
        injectAvatarSelectors();
        addVideoHistoryButton();
    }, 100);
};

// Pulse animation for highlighting
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% { transform: scale(1); box-shadow: var(--shadow-md); }
        50% { transform: scale(1.02); box-shadow: var(--shadow-lg), 0 0 20px rgba(102, 126, 234, 0.5); }
    }
`;
document.head.appendChild(style);

// ============================================================================
// AVATAR SELECTOR & IMAGE SOURCE MANAGEMENT
// ============================================================================

let selectedAvatars = {
    single: null,
    multi: null
};

let imageSourceMode = {
    single: 'avatars',  // 'avatars' or 'upload'
    multi: 'avatars'
};

let batchImageAssignments = {}; // { batchId: { type: 'shared' | 'specific', imageData: ... } }

function toggleImageSource(mode, source) {
    imageSourceMode[mode] = source;

    // Update toggle buttons
    const container = mode === 'single' ?
        document.querySelector('#tab-single') :
        document.querySelector('#tab-preview');

    const buttons = container.querySelectorAll('.toggle-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.source === source) {
            btn.classList.add('active');
        }
    });

    // Show/hide appropriate sections
    const avatarSelector = document.getElementById(`${mode}AvatarSelector`);
    const uploadSection = document.getElementById(`${mode}UploadSection`);

    if (source === 'avatars') {
        avatarSelector.style.display = 'grid';
        uploadSection.style.display = 'none';
        loadAvatarsIntoSelector(mode);
    } else {
        avatarSelector.style.display = 'none';
        uploadSection.style.display = 'block';
    }
}

async function loadAvatarsIntoSelector(mode) {
    const container = document.getElementById(`${mode}AvatarSelector`);

    try {
        const response = await fetch('/api/avatars');
        const data = await response.json();

        if (data.success && data.avatars.length > 0) {
            container.innerHTML = data.avatars.map(avatar => `
                <div class="avatar-selector-item ${selectedAvatars[mode] === avatar.id ? 'selected' : ''}" 
                     onclick="selectAvatarForGeneration('${mode}', '${avatar.id}')">
                    <img class="avatar-selector-thumb" 
                         src="/api/avatars/${avatar.id}/image" 
                         alt="${avatar.name}">
                    <span class="avatar-selector-name">${avatar.name}</span>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <p class="loading-text">
                    Nenhum avatar salvo. 
                    <a href="#" onclick="document.querySelector('[data-tab=\\"avatars\\"]').click(); return false;">
                        Criar avatar
                    </a>
                </p>
            `;
        }
    } catch (error) {
        container.innerHTML = '<p class="loading-text">Erro ao carregar avatares</p>';
        console.error('Error loading avatars:', error);
    }
}

function selectAvatarForGeneration(mode, avatarId) {
    selectedAvatars[mode] = avatarId;
    loadAvatarsIntoSelector(mode);
}

async function getImagesForGeneration(mode) {
    if (imageSourceMode[mode] === 'avatars' && selectedAvatars[mode]) {
        // Get avatar image path
        try {
            const response = await fetch(`/api/avatars/${selectedAvatars[mode]}`);
            const data = await response.json();

            if (data.success) {
                return [data.avatar.image_path];
            }
        } catch (error) {
            console.error('Error getting avatar:', error);
        }
    }

    // Fallback to uploaded images
    const images = mode === 'single' ? AppState.singleImages : AppState.multiImages;
    if (images.length > 0) {
        return await uploadImages(images);
    }

    throw new Error('Nenhuma imagem selecionada');
}

// ============================================================================
// BATCH IMAGE ASSIGNMENT
// ============================================================================

function initBatchImageSelectors() {
    // Called after preview is generated
    const batchCards = document.querySelectorAll('.batch-card');

    batchCards.forEach((card, idx) => {
        const batchId = `batch_${idx}`;

        // Add image selector UI to batch card
        const selector = document.createElement('div');
        selector.className = 'batch-image-selector';
        selector.innerHTML = `
            <div class="batch-image-options">
                <button class="batch-image-btn active" data-option="shared" onclick="setBatchImageOption('${batchId}', 'shared')">
                    Usar Imagem Compartilhada
                </button>
                <button class="batch-image-btn" data-option="specific" onclick="setBatchImageOption('${batchId}', 'specific')">
                    Imagem Específica
                </button>
            </div>
            <div id="${batchId}_upload" style="display: none;">
                <div class="batch-upload-mini" onclick="document.getElementById('${batchId}_file').click()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <p style="font-size: 0.75rem; margin: 0;">Clique para selecionar</p>
                </div>
                <input type="file" id="${batchId}_file" accept="image/*" style="display: none;" 
                       onchange="handleBatchImageUpload('${batchId}', this.files[0])">
                <div id="${batchId}_preview"></div>
            </div>
        `;

        card.appendChild(selector);

        // Initialize with shared option
        batchImageAssignments[batchId] = { type: 'shared', imageData: null };
    });
}

function setBatchImageOption(batchId, option) {
    const card = document.querySelector(`#${batchId}_upload`).parentElement;
    const buttons = card.querySelectorAll('.batch-image-btn');

    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.option === option);
    });

    const uploadSection = document.getElementById(`${batchId}_upload`);
    uploadSection.style.display = option === 'specific' ? 'block' : 'none';

    batchImageAssignments[batchId].type = option;
}

function handleBatchImageUpload(batchId, file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById(`${batchId}_preview`);
        preview.innerHTML = `
            <div class="batch-selected-image">
                <img class="batch-thumb" src="${e.target.result}" alt="Batch image">
                <span style="flex: 1; font-size: 0.875rem;">${file.name}</span>
                <button class="btn-icon" onclick="clearBatchImage('${batchId}')" title="Remover">×</button>
            </div>
        `;

        batchImageAssignments[batchId].imageData = file;
    };
    reader.readAsDataURL(file);
}

function clearBatchImage(batchId) {
    document.getElementById(`${batchId}_preview`).innerHTML = '';
    batchImageAssignments[batchId].imageData = null;
}

async function getBatchImagePaths() {
    // Upload all batch-specific images first
    const specificImages = [];
    const batchMapping = {};

    for (const [batchId, assignment] of Object.entries(batchImageAssignments)) {
        if (assignment.type === 'specific' && assignment.imageData) {
            specificImages.push(assignment.imageData);
        }
    }

    if (specificImages.length > 0) {
        const formData = new FormData();
        specificImages.forEach(img => formData.append('images', img));

        const response = await fetch('/api/upload/images', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (data.success) {
            let pathIndex = 0;
            for (const [batchId, assignment] of Object.entries(batchImageAssignments)) {
                if (assignment.type === 'specific' && assignment.imageData) {
                    batchMapping[batchId] = data.paths[pathIndex++];
                }
            }
        }
    }

    return batchMapping;
}

// ============================================================================
// VIDEO HISTORY
// ============================================================================

async function loadVideoHistory() {
    try {
        const response = await fetch('/api/videos/history');
        const data = await response.json();

        if (data.success) {
            displayVideoHistory(data.videos);
        }
    } catch (error) {
        console.error('Error loading video history:', error);
    }
}

function displayVideoHistory(videos) {
    const container = document.getElementById('videoHistoryGrid');

    if (!videos || videos.length === 0) {
        container.innerHTML = `
            <div class="empty-state-large" style="grid-column: 1/-1;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                    <line x1="7" y1="2" x2="7" y2="22"></line>
                    <line x1="17" y1="2" x2="17" y2="22"></line>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <line x1="2" y1="7" x2="7" y2="7"></line>
                    <line x1="2" y1="17" x2="7" y2="17"></line>
                    <line x1="17" y1="17" x2="22" y2="17"></line>
                    <line x1="17" y1="7" x2="22" y2="7"></line>
                </svg>
                <p>Nenhum vídeo no histórico</p>
            </div>
        `;
        return;
    }

    container.innerHTML = videos.map(video => `
        <div class="video-history-item">
            <video class="video-history-thumb" 
                   src="/api/download/${encodeURIComponent(video.path)}" 
                   preload="metadata"></video>
            <div class="video-history-info">
                <div class="video-history-name">${video.name}</div>
                <div class="video-history-meta">
                    ${formatDate(video.created_at)} • ${formatFileSize(video.size)}
                </div>
                <div class="video-history-actions">
                    <button class="btn btn-secondary" onclick="playVideo('${video.path}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Play
                    </button>
                    <button class="btn btn-secondary" onclick="downloadVideo('${video.path}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function playVideo(path) {
    // Open video in modal or navigate to jobs tab
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.src = `/api/download/${encodeURIComponent(path)}`;
    document.getElementById('videoContainer').style.display = 'block';

    // Switch to single video tab to show player
    document.querySelector('[data-tab="single"]').click();
    videoPlayer.scrollIntoView({ behavior: 'smooth' });
}

function downloadVideo(path) {
    window.open(`/api/download/${encodeURIComponent(path)}`, '_blank');
}

// ============================================================================
// ENHANCED JOBS TIMELINE WITH VIDEO PREVIEWS
// ============================================================================

function displayJobsTimelineEnhanced(jobs) {
    const container = document.getElementById('jobsTimeline');

    if (jobs.length === 0) {
        container.innerHTML = `
            <div class="empty-state-large">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <p>Nenhum job em processamento</p>
            </div>
        `;
        return;
    }

    jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    container.innerHTML = jobs.map(job => `
        <div class="job-item">
            <div class="job-header">
                <div class="job-title">${job.type} - Job #${job.id}</div>
                <span class="job-status ${job.status}">${getStatusText(job.status)}</span>
            </div>
            
            <div class="job-info">
                <div>Criado: ${new Date(job.created_at).toLocaleString()}</div>
                ${job.completed_at ? `<div>Concluído: ${new Date(job.completed_at).toLocaleString()}</div>` : ''}
            </div>
            
            ${job.status === 'processing' ? `
                <div class="job-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${job.progress || 50}%"></div>
                    </div>
                    <p class="progress-text">Processando... ${job.progress || 50}%</p>
                </div>
            ` : ''}
            
            ${job.status === 'completed' && job.video_path ? `
                <div class="job-video-preview">
                    <video controls preload="metadata">
                        <source src="/api/download/${encodeURIComponent(job.video_path)}" type="video/mp4">
                    </video>
                </div>
                
                <div class="job-metadata">
                    <div class="job-metadata-item">
                        <div class="job-metadata-label">Vídeo</div>
                        <div class="job-metadata-value">${job.video_path.split('/').pop()}</div>
                    </div>
                    ${job.metadata ? `
                        ${job.metadata.duration ? `
                            <div class="job-metadata-item">
                                <div class="job-metadata-label">Duração</div>
                                <div class="job-metadata-value">${job.metadata.duration}s</div>
                            </div>
                        ` : ''}
                    ` : ''}
                </div>
                
                <div class="job-actions">
                    <button class="btn btn-primary" onclick="downloadJobVideo('${job.video_path}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Update the original displayJobsTimeline to use enhanced version
window.displayJobsTimeline = displayJobsTimelineEnhanced;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Load avatars into selectors on init
    if (document.getElementById('singleAvatarSelector')) {
        loadAvatarsIntoSelector('single');
    }
    if (document.getElementById('multiAvatarSelector')) {
        loadAvatarsIntoSelector('multi');
    }
});
