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
            search: true,
            url: true,
            code: false,
            temp: "0.70",
            topP: "0.95",
            instructions: "",
            disable: false
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
        const currentConfig = {
            search: document.getElementById('btn-search')?.classList.contains('active') ?? true,
            url: document.getElementById('btn-url')?.classList.contains('active') ?? true,
            code: document.getElementById('btn-code')?.classList.contains('active') ?? false,
            temp: document.getElementById('range-temp')?.value ?? "0.70",
            topP: document.getElementById('range-top-p')?.value ?? "0.95",
            instructions: instructionsText?.value ?? "",
            disable: toggleDisable?.checked ?? false
        };
        btnSaveConfig.disabled = JSON.stringify(currentConfig) === originalConfig;
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
        document.getElementById('btn-search')?.classList.toggle('active', !!config.search);
        document.getElementById('btn-url')?.classList.toggle('active', !!config.url);
        document.getElementById('btn-code')?.classList.toggle('active', !!config.code);

        ['temp', 'top-p'].forEach(id => {
            const range = document.getElementById(`range-${id}`);
            const input = document.getElementById(`val-${id}`);
            const key = id === 'temp' ? 'temp' : 'topP';
            if (range) { range.value = config[key]; updateSliderProgress(range); }
            if (input) { input.value = config[key]; }
        });

        if (instructionsText) instructionsText.value = config.instructions || "";
        if (toggleDisable) toggleDisable.checked = !!config.disable;
    };

    const applyActiveTab = (tabId) => {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.textContent.trim().toUpperCase() === tabId.toUpperCase());
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

    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.onclick = (e) => { if (e.target === m) closeModal(m); };
        m.querySelector('.btn-close-modal')?.addEventListener('click', () => closeModal(m));
    });

    const saveCurrentConfig = (feedback = false) => {
        const config = {
            search: document.getElementById('btn-search')?.classList.contains('active'),
            url: document.getElementById('btn-url')?.classList.contains('active'),
            code: document.getElementById('btn-code')?.classList.contains('active'),
            temp: document.getElementById('range-temp')?.value,
            topP: document.getElementById('range-top-p')?.value,
            instructions: instructionsText?.value || "",
            disable: toggleDisable?.checked
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
                setTimeout(() => { btnSaveConfig.textContent = oldText; btnSaveConfig.style.background = ''; btnSaveConfig.style.color = ''; checkChanges(); }, 1000);
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
    if (btnSaveInstructions) btnSaveInstructions.onclick = () => { state.config.instructions = instructionsText.value; closeModal(modalInstructions); saveCurrentConfig(); };

    // Quick Buttons
    const quickButtonsContainer_I = document.getElementById('quick-buttons');
    if (quickButtonsContainer_I) {
        quickButtonsContainer_I.innerHTML = '';
        [{ l: 'Concise', t: 'Short answers.' }, { l: 'Technical', t: 'Deep dive.' }, { l: 'Creative', t: 'Unconventional.' }].forEach(a => {
            const b = document.createElement('button');
            b.className = 'btn-toggle'; b.textContent = a.l; b.style.fontSize = '9px';
            b.onclick = () => { instructionsText.value = a.t; checkChanges(); };
            quickButtonsContainer_I.appendChild(b);
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
            state.activeTab = tab.textContent.trim().toUpperCase();
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
            state.config[r.id === 'range-temp' ? 'temp' : 'topP'] = r.value;
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
                state.config[r.id === 'range-temp' ? 'temp' : 'topP'] = r.value;
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
        saveCurrentConfig();
    });

    if (toggleDisable) toggleDisable.onchange = (e) => {
        if (e.target.checked) {
            showConfirm("DISABLE SYSTEM", "This will suspend all Better AI Studio enhancements. Proceed?", () => {
                saveCurrentConfig();
            });
            // Revert visually until confirmed
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

        presetsContainer.querySelectorAll('.btn-up').forEach(btn => btn.onclick = (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            if (idx > 0) {
                const temp = state.presets[idx];
                state.presets[idx] = state.presets[idx - 1];
                state.presets[idx - 1] = temp;
                if (state.activePresetIndex === idx) state.activePresetIndex = idx - 1;
                else if (state.activePresetIndex === idx - 1) state.activePresetIndex = idx;
                savePresets();
            }
        });

        presetsContainer.querySelectorAll('.btn-down').forEach(btn => btn.onclick = (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            if (idx < state.presets.length - 1) {
                const temp = state.presets[idx];
                state.presets[idx] = state.presets[idx + 1];
                state.presets[idx + 1] = temp;
                if (state.activePresetIndex === idx) state.activePresetIndex = idx + 1;
                else if (state.activePresetIndex === idx + 1) state.activePresetIndex = idx;
                savePresets();
            }
        });

        presetsContainer.querySelectorAll('.preset-title').forEach(el => {
            el.onclick = () => {
                const idx = parseInt(el.dataset.index);
                if (state.activePresetIndex !== idx) {
                    state.activePresetIndex = idx;
                    savePresets();
                }
            };
            el.ondblclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idx = parseInt(el.dataset.index);
                const span = el.querySelector('.title-text');
                if (!span) return;
                const inp = document.createElement('input');
                inp.className = 'rename-input';
                inp.value = state.presets[idx].name;
                span.replaceWith(inp);
                inp.focus();
                inp.select();
                inp.onblur = () => { if (inp.value.trim()) state.presets[idx].name = inp.value.trim(); savePresets(); };
                inp.onkeydown = (ev) => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { renderPresets(); } };
            };
        });
    };

    loadState();
});
