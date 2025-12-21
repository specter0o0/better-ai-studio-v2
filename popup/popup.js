/**
 * Better AI Studio - Industrial Mirror Sync Logic (v1.1.9)
 * Ensures absolute zero-delay synchronization across all same-origin instances.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const presetsContainer = document.getElementById('presets-container');
    const btnAddPreset = document.getElementById('btn-add-preset');
    const btnSaveConfig = document.getElementById('btn-save-config');
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const btnSettings = document.getElementById('btn-settings');
    const btnOpenInstructions = document.getElementById('btn-open-instructions');
    const ranges = document.querySelectorAll('.bas-range');
    const instructionsText = document.getElementById('instructions-text');
    const newPresetName = document.getElementById('new-preset-name');
    const quickButtonsContainer = document.getElementById('quick-buttons');
    const toggleDisable = document.getElementById('toggle-disable');
    const btnResetData = document.getElementById('btn-reset-data');

    // Modals
    const modalInstructions = document.getElementById('modal-instructions');
    const modalNewPreset = document.getElementById('modal-new-preset');
    const modalSettings = document.getElementById('modal-settings');
    const btnSaveInstructions = document.getElementById('btn-save-instructions');
    const btnConfirmPreset = document.getElementById('btn-confirm-preset');

    // --- State Management ---
    let state = {
        presets: [],
        activePresetIndex: -1,
        activeTab: 'PRESETS',
        config: {
            model: "gemini-3-pro",
            search: true,
            url: true,
            code: false,
            temp: "0.70",
            topP: "0.95",
            maxTokens: "2048",
            structured: false,
            structuredSchema: "",
            functions: false,
            functionsSchema: "",
            instructions: "",
            disable: false,
            // General Settings
            autoCloseNav: BAS_CONFIG.settings.autoCloseNav,
            autoCloseSettings: BAS_CONFIG.settings.autoCloseSettings,
            collapseHistory: BAS_CONFIG.settings.collapseHistory,
            hideEmail: BAS_CONFIG.settings.hideEmail,
            aspectRatio: "1:1",
            resolution: "Low"
        },
        theme: 'dark'
    };

    let originalConfig = JSON.stringify(state.config);

    // --- Absolute Sync Engine ---
    const syncChannel = new BroadcastChannel('bas_mirror_sync');

    const broadcastState = () => {
        syncChannel.postMessage({
            type: 'MIRROR_HEARTBEAT',
            state: JSON.parse(JSON.stringify(state))
        });
    };

    syncChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'MIRROR_HEARTBEAT') {
            const incoming = event.data.state;
            if (incoming) {
                state = { ...state, ...incoming };
                applyAllUI(false);
            }
        }
    };

    window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('bas_')) loadState(false);
    });

    const applyAllUI = (shouldBroadcast = true) => {
        applyTheme(state.theme);
        applyConfig(state.config);
        applyActiveTab(state.activeTab);
        renderPresets();
        checkChanges();
        if (shouldBroadcast) broadcastState();
    };

    // --- Utilities ---
    const updateSliderProgress = (range) => {
        if (!range) return;
        const val = range.value;
        const min = range.min || 0;
        const max = range.max || 100;
        const percent = ((val - min) / (max - min)) * 100;
        range.style.background = `linear-gradient(to right, var(--bas-accent) ${percent}%, var(--bas-border-strong) ${percent}%)`;
    };

    const checkChanges = () => {
        if (!btnSaveConfig) return;
        const getVal = (id) => {
            const el = document.getElementById(id) || document.getElementById(id + '-tab');
            if (!el) return null;
            if (el.type === 'checkbox') return el.checked;
            return el.value;
        };
        const currentConfig = {
            model: getVal('select-model') ?? "gemini-3-pro",
            search: document.getElementById('btn-search')?.classList.contains('active') ?? true,
            url: document.getElementById('btn-url')?.classList.contains('active') ?? true,
            code: document.getElementById('btn-code')?.classList.contains('active') ?? false,
            structured: document.getElementById('btn-structured')?.classList.contains('active') ?? false,
            structuredSchema: getVal('structured-schema-text') ?? "",
            functions: document.getElementById('btn-functions')?.classList.contains('active') ?? false,
            functionsSchema: getVal('functions-schema-text') ?? "",
            temp: getVal('range-temp') ?? "0.70",
            topP: getVal('range-top-p') ?? "0.95",
            maxTokens: getVal('range-max-tokens') ?? "2048",
            instructions: instructionsText?.value ?? "",
            disable: getVal('toggle-disable') ?? false,
            autoCloseNav: getVal('setting-auto-nav') ?? true,
            autoCloseSettings: getVal('setting-auto-settings') ?? true,
            collapseHistory: getVal('setting-collapse-history') ?? true,
            hideEmail: getVal('setting-hide-email') ?? true,
            aspectRatio: getVal('select-aspect-ratio') ?? "1:1",
            resolution: getVal('select-resolution') ?? "Low"
        };
        btnSaveConfig.disabled = JSON.stringify(currentConfig) === originalConfig;
    };

    // --- Mirroring Logic & Constraints ---
    const applyMirroring = (sourceId, shouldBroadcast = true) => {
        const modelKey = document.getElementById('select-model')?.value || 'gemini-3-pro';
        const caps = BAS_CONFIG.models[modelKey]?.capabilities || { search: true, code: true, functions: true, structured: true };

        const btnSearch = document.getElementById('btn-search');
        const btnUrl = document.getElementById('btn-url');
        const btnCode = document.getElementById('btn-code');
        const btnStructured = document.getElementById('btn-structured');
        const btnFunctions = document.getElementById('btn-functions');

        // 1. Model Support
        btnSearch.style.display = caps.search ? 'block' : 'none';
        btnUrl.style.display = caps.url ? 'block' : 'none';
        btnCode.style.display = caps.code ? 'block' : 'none';
        btnStructured.parentElement.style.display = caps.structured ? 'flex' : 'none';
        btnFunctions.parentElement.style.display = caps.functions ? 'flex' : 'none';

        // 2. Interaction Exclusivity (Like the Website)
        if (sourceId === 'btn-functions' && btnFunctions.classList.contains('active')) {
            // Function Calling is exclusive to ALL
            btnSearch.classList.remove('active');
            btnUrl.classList.remove('active');
            btnCode.classList.remove('active');
            btnStructured.classList.remove('active');
        } else if (sourceId === 'btn-structured' && btnStructured.classList.contains('active')) {
            // Structured Output is exclusive to Code and Functions
            btnCode.classList.remove('active');
            btnFunctions.classList.remove('active');
        } else if (sourceId === 'btn-code' && btnCode.classList.contains('active')) {
            // Code is exclusive to Structured and Functions
            btnStructured.classList.remove('active');
            btnFunctions.classList.remove('active');
        } else if ((sourceId === 'btn-search' || sourceId === 'btn-url') && (btnSearch.classList.contains('active') || btnUrl.classList.contains('active'))) {
            // Search/URL are exclusive to Functions
            btnFunctions.classList.remove('active');
        }

        // Update state
        state.config.search = btnSearch.classList.contains('active');
        state.config.url = btnUrl.classList.contains('active');
        state.config.code = btnCode.classList.contains('active');
        state.config.structured = btnStructured.classList.contains('active');
        state.config.functions = btnFunctions.classList.contains('active');

        // General settings sync
        state.config.autoCloseNav = document.getElementById('setting-auto-nav')?.checked;
        state.config.autoCloseSettings = document.getElementById('setting-auto-settings')?.checked;
        state.config.collapseHistory = document.getElementById('setting-collapse-history')?.checked;
        state.config.hideEmail = document.getElementById('setting-hide-email')?.checked;

        updateSchemaButtonStates();
        if (shouldBroadcast) broadcastState();
        checkChanges();
    };

    const updateSchemaButtonStates = () => {
        const btnStrEdit = document.getElementById('btn-edit-structured');
        const btnFunEdit = document.getElementById('btn-edit-functions');
        const btnStr = document.getElementById('btn-structured');
        const btnFun = document.getElementById('btn-functions');

        if (btnStrEdit) {
            const isActive = btnStr?.classList.contains('active');
            btnStrEdit.classList.toggle('active', !!isActive);
            btnStrEdit.style.opacity = isActive ? '1' : '0.2';
            btnStrEdit.style.pointerEvents = isActive ? 'auto' : 'none';
        }
        if (btnFunEdit) {
            const isActive = btnFun?.classList.contains('active');
            btnFunEdit.classList.toggle('active', !!isActive);
            btnFunEdit.style.opacity = isActive ? '1' : '0.2';
            btnFunEdit.style.pointerEvents = isActive ? 'auto' : 'none';
        }
    };

    const safeStorage = {
        get: (keys, callback) => {
            const isExtension = typeof chrome !== 'undefined' && chrome.runtime?.id;
            if (isExtension && chrome.storage?.local) {
                chrome.storage.local.get(keys, callback);
            } else {
                const result = {};
                keys.forEach(k => {
                    try { result[k] = JSON.parse(localStorage.getItem(`bas_${k}`) || 'null'); } catch (e) { result[k] = null; }
                });
                if (keys.includes('presets') && !result.presets) {
                    result.presets = [{ name: 'MAIN', config: { ...state.config } }];
                }
                setTimeout(() => callback(result), 0);
            }
        },
        set: (data, callback) => {
            const isExtension = typeof chrome !== 'undefined' && chrome.runtime?.id;
            if (isExtension && chrome.storage?.local) {
                chrome.storage.local.set(data, callback);
            } else {
                Object.keys(data).forEach(k => localStorage.setItem(`bas_${k}`, JSON.stringify(data[k])));
                if (callback) setTimeout(callback, 0);
            }
        }
    };

    const loadState = (init = true) => {
        safeStorage.get(['presets', 'config', 'theme', 'activePresetIndex', 'activeTab'], (result) => {
            if (result.presets) state.presets = result.presets;
            if (result.config) state.config = { ...state.config, ...result.config };
            if (result.theme) state.theme = result.theme;
            if (result.activePresetIndex !== null && result.activePresetIndex !== undefined) state.activePresetIndex = result.activePresetIndex;
            if (result.activeTab) state.activeTab = result.activeTab;

            if (init) originalConfig = JSON.stringify(state.config);
            applyAllUI(false);
        });
    };

    // --- Applying UI State ---
    const applyTheme = (theme) => {
        state.theme = theme;
        document.body.classList.toggle('light-theme', theme === 'light');
        const icon = btnThemeToggle?.querySelector('.theme-icon');
        if (icon) {
            icon.innerHTML = theme === 'light' ?
                '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"></path>' :
                '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        }
    };

    const applyConfig = (config) => {
        if (!config) return;
        const selectModel = document.getElementById('select-model');
        if (selectModel) selectModel.value = config.model || "gemini-3-pro";

        document.getElementById('btn-search')?.classList.toggle('active', !!config.search);
        document.getElementById('btn-url')?.classList.toggle('active', !!config.url);
        document.getElementById('btn-code')?.classList.toggle('active', !!config.code);

        document.getElementById('btn-search')?.classList.toggle('active', !!config.search);
        document.getElementById('btn-url')?.classList.toggle('active', !!config.url);
        document.getElementById('btn-code')?.classList.toggle('active', !!config.code);
        document.getElementById('btn-structured')?.classList.toggle('active', !!config.structured);
        document.getElementById('btn-functions')?.classList.toggle('active', !!config.functions);

        const structuredText = document.getElementById('structured-schema-text');
        if (structuredText) structuredText.value = config.structuredSchema || "";

        const functionsText = document.getElementById('functions-schema-text');
        if (functionsText) functionsText.value = config.functionsSchema || "";

        updateSchemaButtonStates();

        ['temp', 'top-p', 'max-tokens'].forEach(id => {
            const range = document.getElementById(`range-${id}`);
            const input = document.getElementById(`val-${id}`);
            let key = '';
            if (id === 'temp') key = 'temp';
            else if (id === 'top-p') key = 'topP';
            else if (id === 'max-tokens') key = 'maxTokens';

            if (range) { range.value = config[key]; updateSliderProgress(range); }
            if (input) { input.value = config[key]; }
        });

        if (instructionsText) instructionsText.value = config.instructions || "";
        if (toggleDisable) toggleDisable.checked = !!config.disable;

        // General settings
        const hideEmail = document.getElementById('setting-hide-email');
        if (hideEmail) hideEmail.checked = config.hideEmail !== false;
        const autoNav = document.getElementById('setting-auto-nav');
        if (autoNav) autoNav.checked = config.autoCloseNav !== false;
        const autoSettings = document.getElementById('setting-auto-settings');
        if (autoSettings) autoSettings.checked = config.autoCloseSettings !== false;
        const collapseHistory = document.getElementById('setting-collapse-history');
        if (collapseHistory) collapseHistory.checked = config.collapseHistory !== false;

        // Update Slider Ranges based on model
        const modelData = BAS_CONFIG.models[config.model || 'gemini-3-pro'];
        if (modelData && modelData.tempRange) {
            const tempRange = document.getElementById('range-temp');
            if (tempRange) {
                tempRange.min = modelData.tempRange.min;
                tempRange.max = modelData.tempRange.max;
                tempRange.step = modelData.tempRange.step;
            }
        }

        // Nano specific UI
        const nanoSection = document.getElementById('nano-settings');
        if (nanoSection) {
            nanoSection.style.display = config.model === 'nano-banana-pro' ? 'flex' : 'none';
        }
        const selectAspect = document.getElementById('select-aspect-ratio');
        if (selectAspect) selectAspect.value = config.aspectRatio || "1:1";
        const selectRes = document.getElementById('select-resolution');
        if (selectRes) selectRes.value = config.resolution || "Low";

        applyMirroring('init', false); // DO NOT broadcast during apply
    };

    const applyActiveTab = (tabId) => {
        const normalizedTabId = tabId.toLowerCase();
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab.toLowerCase() === normalizedTabId);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${normalizedTabId}`);
        });
    };

    // --- Custom Confirm Logic ---
    const modalConfirm = document.getElementById('modal-confirm');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const btnConfirmOk = document.getElementById('btn-confirm-ok');
    const btnConfirmCancel = document.getElementById('btn-confirm-cancel');

    const showConfirm = (title, msg, onOk) => {
        if (!modalConfirm) return;
        confirmTitle.textContent = title || "System Alert";
        confirmMessage.textContent = msg || "Are you sure you want to proceed?";
        openModal(modalConfirm);
        btnConfirmOk.onclick = () => { onOk(); closeModal(modalConfirm); };
        btnConfirmCancel.onclick = () => closeModal(modalConfirm);
    };

    // --- Interactions ---
    const openModal = (m) => { if (m) m.style.display = 'flex'; };
    const closeModal = (m) => { if (m) m.style.display = 'none'; };

    document.querySelectorAll('.modal-overlay:not(#modal-confirm)').forEach(m => {
        m.onclick = (e) => { if (e.target === m) closeModal(m); };
        m.querySelector('.btn-close-modal')?.addEventListener('click', () => closeModal(m));
    });

    const saveCurrentConfig = (feedback = false) => {
        const getVal = (id) => {
            const el = document.getElementById(id) || document.getElementById(id + '-tab');
            if (!el) return null;
            if (el.type === 'checkbox') return el.checked;
            return el.value;
        };
        const config = {
            model: getVal('select-model'),
            search: document.getElementById('btn-search')?.classList.contains('active'),
            url: document.getElementById('btn-url')?.classList.contains('active'),
            code: document.getElementById('btn-code')?.classList.contains('active'),
            structured: document.getElementById('btn-structured')?.classList.contains('active'),
            structuredSchema: getVal('structured-schema-text') || "",
            functions: document.getElementById('btn-functions')?.classList.contains('active'),
            functionsSchema: getVal('functions-schema-text') || "",
            temp: getVal('range-temp'),
            topP: getVal('range-top-p'),
            maxTokens: getVal('range-max-tokens'),
            instructions: instructionsText?.value || "",
            disable: getVal('toggle-disable'),
            hideEmail: getVal('setting-hide-email'),
            autoCloseNav: getVal('setting-auto-nav'),
            autoCloseSettings: getVal('setting-auto-settings'),
            collapseHistory: getVal('setting-collapse-history'),
            aspectRatio: getVal('select-aspect-ratio'),
            resolution: getVal('select-resolution')
        };
        state.config = config;
        originalConfig = JSON.stringify(config);
        safeStorage.set({ config }, () => {
            checkChanges();
            broadcastState();
            if (feedback && btnSaveConfig) {
                const oldText = btnSaveConfig.textContent;
                btnSaveConfig.textContent = 'SAVED';
                btnSaveConfig.style.background = '#4ade80';
                btnSaveConfig.style.color = '#000';
                setTimeout(() => { btnSaveConfig.textContent = oldText; btnSaveConfig.style.background = ''; btnSaveConfig.style.color = ''; checkChanges(); }, 800);
            }
        });
    };

    const savePresets = () => safeStorage.set({ presets: state.presets, activePresetIndex: state.activePresetIndex }, () => { renderPresets(); broadcastState(); });

    // --- Triggers ---
    if (btnAddPreset) btnAddPreset.onclick = () => { newPresetName.value = ""; openModal(modalNewPreset); };
    if (btnConfirmPreset) btnConfirmPreset.onclick = () => {
        const name = newPresetName.value.trim();
        if (name) {
            state.presets.push({ name, timestamp: Date.now(), config: { ...state.config } });
            state.activePresetIndex = state.presets.length - 1;
            savePresets();
            closeModal(modalNewPreset);
        }
    };
    if (btnSaveConfig) btnSaveConfig.onclick = () => {
        if (state.presets.length === 0) { openModal(modalNewPreset); return; }
        saveCurrentConfig(true);
    };
    if (btnThemeToggle) btnThemeToggle.onclick = () => {
        state.theme = (state.theme === 'light') ? 'dark' : 'light';
        safeStorage.set({ theme: state.theme }, () => { applyTheme(state.theme); broadcastState(); });
    };

    if (btnSettings) btnSettings.onclick = () => openModal(modalSettings);
    if (btnOpenInstructions) btnOpenInstructions.onclick = () => openModal(modalInstructions);
    if (btnSaveInstructions) btnSaveInstructions.onclick = () => {
        state.config.instructions = instructionsText.value;
        closeModal(modalInstructions);
        saveCurrentConfig();
    };

    // Advanced Toggle
    const toggleAdvanced = document.getElementById('toggle-advanced');
    const advancedContent = document.getElementById('advanced-settings-content');
    if (toggleAdvanced && advancedContent) {
        toggleAdvanced.onclick = () => {
            const isOpen = advancedContent.classList.toggle('open');
            toggleAdvanced.classList.toggle('open', isOpen);
            toggleAdvanced.querySelector('span').textContent = isOpen ? 'Show fewer settings' : 'Show more settings';
        };
    }

    // Schema Modals
    const modalStructured = document.getElementById('modal-structured');
    const modalFunctions = document.getElementById('modal-functions');
    const btnEditStructured = document.getElementById('btn-edit-structured');
    const btnEditFunctions = document.getElementById('btn-edit-functions');
    const btnSaveStructured = document.getElementById('btn-save-structured');
    const btnSaveFunctions = document.getElementById('btn-save-functions');

    if (btnEditStructured) btnEditStructured.onclick = () => openModal(modalStructured);
    if (btnEditFunctions) btnEditFunctions.onclick = () => openModal(modalFunctions);

    if (btnSaveStructured) btnSaveStructured.onclick = () => {
        const text = document.getElementById('structured-schema-text').value.trim();
        state.config.structuredSchema = text;
        closeModal(modalStructured);
        saveCurrentConfig();
    };

    if (btnSaveFunctions) btnSaveFunctions.onclick = () => {
        const text = document.getElementById('functions-schema-text').value.trim();
        state.config.functionsSchema = text;
        closeModal(modalFunctions);
        saveCurrentConfig();
    };

    const btnStructured = document.getElementById('btn-structured');
    if (btnStructured) btnStructured.onclick = () => {
        btnStructured.classList.toggle('active');
        applyMirroring('btn-structured');
        saveCurrentConfig();
    };

    const btnFunctions = document.getElementById('btn-functions');
    if (btnFunctions) btnFunctions.onclick = () => {
        btnFunctions.classList.toggle('active');
        applyMirroring('btn-functions');
        saveCurrentConfig();
    };

    // General Settings listeners
    ['setting-hide-email', 'setting-auto-nav', 'setting-auto-settings', 'setting-collapse-history'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.onchange = () => {
            applyMirroring(id);
            saveCurrentConfig();
        };
    });

    const selectModel = document.getElementById('select-model');
    if (selectModel) selectModel.onchange = () => {
        applyMirroring('model');
        saveCurrentConfig();
    };

    const selectAspect = document.getElementById('select-aspect-ratio');
    if (selectAspect) selectAspect.onchange = () => saveCurrentConfig();

    const selectRes = document.getElementById('select-resolution');
    if (selectRes) selectRes.onchange = () => saveCurrentConfig();

    // Quick Buttons
    const qButtons = [{ l: 'Concise', t: 'Short answers.' }, { l: 'Technical', t: 'Deep dive.' }, { l: 'Creative', t: 'Unconventional.' }];
    if (quickButtonsContainer) {
        quickButtonsContainer.innerHTML = '';
        qButtons.forEach(a => {
            const b = document.createElement('button');
            b.className = 'btn-toggle'; b.textContent = a.l; b.style.fontSize = '9px';
            b.onclick = () => { instructionsText.value = a.t; checkChanges(); };
            quickButtonsContainer.appendChild(b);
        });
    }
    if (instructionsText) instructionsText.oninput = () => checkChanges();

    if (btnResetData) btnResetData.onclick = () => {
        showConfirm("FACTORY RESET", "Clear all presets and configurations permanently?", () => {
            localStorage.clear();
            const isExtension = typeof chrome !== 'undefined' && chrome.runtime?.id;
            if (isExtension) chrome.storage.local.clear(() => window.location.reload());
            else window.location.reload();
        });
    };

    document.querySelectorAll('.dropdown-section .section-header').forEach(h => h.onclick = () => h.parentElement.classList.toggle('open'));

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.onclick = () => {
            state.activeTab = tab.dataset.tab.toUpperCase();
            applyActiveTab(state.activeTab);
            safeStorage.set({ activeTab: state.activeTab });
            broadcastState();
        };
    });

    // Slider & Input Sync
    ranges.forEach(r => {
        const input = document.getElementById(r.id.replace('range-', 'val-'));
        r.oninput = () => {
            if (input) input.value = r.value;
            updateSliderProgress(r);
            state.config[{ 'range-temp': 'temp', 'range-top-p': 'topP', 'range-max-tokens': 'maxTokens' }[r.id]] = r.value;
            broadcastState();
            checkChanges();
        };
        r.onchange = () => saveCurrentConfig();

        if (input) {
            input.oninput = () => {
                let val = parseFloat(input.value);
                if (isNaN(val)) return;
                val = Math.max(parseFloat(r.min), Math.min(parseFloat(r.max), val));
                r.value = val;
                updateSliderProgress(r);
                state.config[{ 'range-temp': 'temp', 'range-top-p': 'topP', 'range-max-tokens': 'maxTokens' }[r.id]] = r.value;
                broadcastState();
                checkChanges();
            };
            input.onblur = () => {
                input.value = parseFloat(r.value).toFixed(2);
                saveCurrentConfig();
            };
        }
    });

    document.querySelectorAll('.input-row .btn-toggle').forEach(btn => btn.onclick = () => {
        btn.classList.toggle('active');
        applyMirroring(btn.id);
        saveCurrentConfig();
    });

    if (toggleDisable) toggleDisable.onchange = (e) => {
        if (e.target.checked) {
            showConfirm("DISABLE SYSTEM", "This will suspend all Better AI Studio enhancements. Proceed?", () => {
                saveCurrentConfig();
            });
            e.target.checked = false;
        } else {
            saveCurrentConfig();
        }
    };

    const renderPresets = () => {
        if (!presetsContainer) return;
        presetsContainer.innerHTML = '';
        state.presets.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = `preset-item ${i === state.activePresetIndex ? 'active' : ''}`;
            div.innerHTML = `
                <div class="preset-reorder">
                    <button class="reorder-btn btn-up" data-index="${i}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
                    <button class="reorder-btn btn-down" data-index="${i}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"></polyline></svg></button>
                </div>
                <div class="preset-title" data-index="${i}"><span class="title-text">${p.name}</span></div>
                <button class="icon-button btn-delete" data-index="${i}" style="margin-left: auto; margin-right: 8px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
            `;
            presetsContainer.appendChild(div);
        });

        presetsContainer.querySelectorAll('.btn-delete').forEach(btn => btn.onclick = (e) => {
            e.stopPropagation();
            showConfirm("DELETE PRESET", `Permanently remove "${state.presets[parseInt(btn.dataset.index)].name}"?`, () => {
                const idx = parseInt(btn.dataset.index);
                state.presets.splice(idx, 1);
                if (state.activePresetIndex === idx) state.activePresetIndex = -1;
                else if (state.activePresetIndex > idx) state.activePresetIndex--;
                savePresets();
            });
        });

        const reorder = (idx, dir) => {
            const target = idx + dir;
            if (target >= 0 && target < state.presets.length) {
                [state.presets[idx], state.presets[target]] = [state.presets[target], state.presets[idx]];
                if (state.activePresetIndex === idx) state.activePresetIndex = target;
                else if (state.activePresetIndex === target) state.activePresetIndex = idx;
                savePresets();
            }
        };
        presetsContainer.querySelectorAll('.btn-up').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); reorder(parseInt(btn.dataset.index), -1); });
        presetsContainer.querySelectorAll('.btn-down').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); reorder(parseInt(btn.dataset.index), 1); });

        presetsContainer.querySelectorAll('.preset-title').forEach(el => {
            el.onclick = () => {
                const idx = parseInt(el.dataset.index);
                if (state.activePresetIndex !== idx) {
                    state.activePresetIndex = idx;
                    state.config = { ...state.presets[idx].config };
                    originalConfig = JSON.stringify(state.config);
                    applyConfig(state.config);
                    savePresets();
                    safeStorage.set({ config: state.config });
                }
            };
            el.ondblclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                const idx = parseInt(el.dataset.index);
                const span = el.querySelector('.title-text');
                const inp = document.createElement('input');
                inp.className = 'rename-input'; inp.value = state.presets[idx].name;
                span.replaceWith(inp); inp.focus(); inp.select();
                inp.onblur = () => { if (inp.value.trim()) state.presets[idx].name = inp.value.trim(); renderPresets(); savePresets(); };
                inp.onkeydown = (ev) => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') renderPresets(); };
            };
        });
    };

    loadState();
});
