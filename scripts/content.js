/**
 * Better AI Studio - Content Script (v2.0.0)
 * Atomic, Zero-Delay Sync Engine.
 */

(function () {
    if (window.betterAiStudioActive) return;
    window.betterAiStudioActive = true;

    const log = (...args) => console.log('[BAS Sync]', ...args);

    // --- Core Sync Engine ---
    const BAS_Sync = {
        isApplying: false,
        suppressionStyle: null,
        isStabilizing: false,
        lastInteraction: 0,
        isManualSidebarOpen: false, // New: Tracks user intent
        sidebarWatchdog: null,

        init() {
            log('Engine Initialized');
            this.setupSuppression();
            this.setupListeners();
            this.loadAndApply();
            this.setupObserver();
            this.setupNavigationListener();
            this.setupModelObserver(); // New
        },

        setupSuppression() {
            if (!this.suppressionStyle) {
                this.suppressionStyle = document.createElement('style');
                this.suppressionStyle.id = 'bas-suppression';
                document.head.appendChild(this.suppressionStyle);
            }
        },

        updateSuppression(config) {
            if (!this.suppressionStyle) this.setupSuppression();

            const alwaysHidden = [
                'body.bas-syncing .cdk-overlay-container',
                'body.bas-syncing .cdk-overlay-backdrop',
                'body.bas-syncing ms-system-instructions',
                'body.bas-syncing .cdk-global-overlay-wrapper'
            ];

            // Only hide settings if we intend to manipulate/close it and want it invisible
            if (config.autoCloseSettings !== false) {
                alwaysHidden.push('body.bas-syncing ms-run-settings');
            }

            this.suppressionStyle.textContent = `
                /* Ghost Sync: Invisible but interactive for JS */
                ${alwaysHidden.join(',\n')} {
                    opacity: 0 !important;
                    pointer-events: none !important;
                    transition: none !important;
                }
            `;
        },

        toggleSuppression(active) {
            document.body.classList.toggle('bas-syncing', active);
        },

        apply(config) {
            if (!config || config.disable) return;

            // Store latest config for reference
            this.currentConfig = config;
            log('Apply triggered (non-blocking)', config?.model);

            // ZERO DELAY: Run everything asynchronously, do NOT block the caller
            (async () => {
                const recentInteraction = Date.now() - this.lastInteraction < 2000;

                // Skip model switching if user just interacted with it
                if (!this.userJustSwitchedModel && !recentInteraction) {
                    this.applyModel(config.model); // Fire & forget
                }
                this.userJustSwitchedModel = false;

                // Fire & forget all other sync tasks
                this.applyParameters(config);
                this.applyTools(config);
                this.applyInstructions(config.instructions, config);
                this.applyUIAjustments(config);

                // Cleanup after a small delay to let UI settle
                if (!recentInteraction) {
                    setTimeout(() => this.ensurePanelsClosed(config), 500);
                }
            })();
        },

        applyUIAjustments(config) {
            // Class-based adjustments for zero flicker (only for PII hiding)
            document.body.classList.toggle('bas-hide-email', config.hideEmail !== false);

            if (config.hideEmail !== false) this.hideEmail();
            if (config.collapseHistory !== false) this.collapseHistory();

            // Immediate Sidebar Collapse (if enabled and no manual override)
            log(`autoCloseNav check: config.autoCloseNav=${config.autoCloseNav}, isManualSidebarOpen=${this.isManualSidebarOpen}`);
            if (config.autoCloseNav !== false && !this.isManualSidebarOpen) {
                this.collapseSidebarNow();
            } else {
                log('Sidebar collapse skipped:', config.autoCloseNav === false ? 'disabled in config' : 'manual override active');
            }

            // Persistent Watchdog for Sidebar (handles SPA navigation)
            if (config.autoCloseNav !== false) {
                this.setupSidebarWatchdog();
            }

            // Smart Stabilization...
            this.isStabilizing = true;
            let attempts = 0;
            const interval = setInterval(() => {
                const focused = document.activeElement;
                // AI Studio often focuses the prompt box or body automatically. 
                // We should NOT stop stabilization for these system focus events.
                const isSystemFocus = !focused ||
                    focused.tagName === 'BODY' ||
                    focused.closest('ms-prompt-input') ||
                    focused.closest('.prompt-input-wrapper');

                const isUserActive = (Date.now() - this.lastInteraction < 2000) ||
                    (focused && (focused.tagName === 'TEXTAREA' || focused.tagName === 'INPUT') && !isSystemFocus) ||
                    !!document.querySelector('.cdk-overlay-pane:hover');

                if (isUserActive || !this.isStabilizing) {
                    if (isUserActive) log('Stabilization aborted: User is active');
                    clearInterval(interval);
                    this.isStabilizing = false;
                    return;
                }

                if (config.autoCloseSettings !== false) this.ensurePanelsClosed(config);

                if (++attempts > 15) { // 3 seconds total (200ms * 15)
                    clearInterval(interval);
                    this.isStabilizing = false;
                }
            }, 200);
        },

        collapseSidebarNow() {
            log('collapseSidebarNow() CALLED');

            const tryCollapse = (attempt = 0) => {
                const sidebar = document.querySelector('ms-navbar') ||
                    document.querySelector('.nav-content') ||
                    document.querySelector('.v3-left-nav');

                const toggle = document.querySelector('button[aria-label="Toggle navigation menu"]');

                log(`[Sidebar Attempt ${attempt}]`, {
                    sidebarFound: !!sidebar,
                    sidebarWidth: sidebar ? sidebar.offsetWidth : 'N/A',
                    toggleFound: !!toggle,
                    toggleVisible: toggle ? (toggle.offsetParent !== null) : false
                });

                if (sidebar && sidebar.offsetWidth > 100) {
                    if (toggle) {
                        log('>>> CLICKING SIDEBAR TOGGLE <<<');
                        toggle.click();
                        return;
                    } else {
                        log('!!! TOGGLE BUTTON NOT FOUND !!!');
                    }
                } else if (!sidebar && attempt < 5) {
                    setTimeout(() => tryCollapse(attempt + 1), 200);
                    return;
                }

                if (sidebar && sidebar.offsetWidth <= 100) {
                    log('Sidebar appears collapsed (width <= 100)');
                }
            };

            tryCollapse();
        },

        setupSidebarWatchdog() {
            if (this.sidebarWatchdog) return;

            log('Initializing Sidebar Watchdog (Seamless)...');
            this.sidebarWatchdog = new MutationObserver(() => {
                const sidebar = document.querySelector('ms-navbar') ||
                    document.querySelector('.nav-content') ||
                    document.querySelector('.v3-left-nav');

                // Logic: If user toggled it manually, we NEVER interfere until reload.
                // This ensures "Opening" animation doesn't trick us into resetting the flag.

                // If user interacted in last 2 seconds or wants it open: SKIP.
                if (Date.now() - this.lastInteraction < 2000 || this.isStabilizing || this.isManualSidebarOpen) return;

                // Detection: AI Studio re-opened it during SPA navigation
                if (sidebar && sidebar.offsetWidth > 100) {
                    const toggle = document.querySelector('button[aria-label="Toggle navigation menu"]');
                    if (toggle) {
                        log('Watchdog: Seamlessly syncing collapsed state...');
                        toggle.click();
                        // Reset interaction timer to prevent jitter
                        this.lastInteraction = Date.now() - 1500;
                    }
                }
            });

            this.sidebarWatchdog.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        },

        hideEmail() {
            const emailSelector = '.account-switcher-container span, .account-switcher-button span, .user-button span, .user-info-container span';

            const performHide = () => {
                const elements = Array.from(document.querySelectorAll(emailSelector));
                const emailEl = elements.find(s => s.textContent.includes('@') || (s.textContent.length > 5 && !s.textContent.includes(' ')));

                if (emailEl) {
                    const text = emailEl.textContent;
                    // If it's an email or looks like an email prefix
                    if (text.includes('@') || (text.length > 5 && !text.includes(' '))) {
                        let name = sessionStorage.getItem('bas_user_name');
                        if (name) {
                            if (emailEl.textContent !== name) {
                                emailEl.textContent = name;
                                emailEl.classList.add('bas-email-replacement');
                                log('Email replaced with name (cache)');
                            }
                        } else {
                            const accountBtn = document.querySelector('button.account-switcher-button, .account-switcher-button, button.user-button');
                            if (accountBtn) {
                                log('Opening account menu briefly to fetch name...');
                                accountBtn.click();

                                let attempts = 0;
                                const pollName = setInterval(() => {
                                    const nameEl = document.querySelector('.cdk-overlay-pane .name, #account-switcher .name, .account-details-container .name');
                                    if (nameEl) {
                                        clearInterval(pollName);
                                        name = nameEl.textContent.trim().split('\n')[0].trim();
                                        if (name) {
                                            sessionStorage.setItem('bas_user_name', name);
                                            emailEl.textContent = name;
                                            emailEl.classList.add('bas-email-replacement');
                                            log('Email replaced with name (fetched: ' + name + ')');
                                        }
                                        document.body.click();
                                    } else if (attempts > 35) {
                                        clearInterval(pollName);
                                        document.body.click();
                                    }
                                    attempts++;
                                }, 100);
                            }
                        }
                    }
                }
            };

            performHide();
            if (!document._bas_email_observer) {
                const observer = new MutationObserver(() => performHide());
                observer.observe(document.body, { childList: true, subtree: true });
                document._bas_email_observer = true;
            }
        },

        closeNavigation() {
            // Updated for latest AI Studio UI
            const nav = document.querySelector('nav');
            const navBtn = document.querySelector('button[aria-label="Toggle navigation menu"]');

            // In the new UI, nav width is > 100 when expanded
            if (navBtn && nav && nav.offsetWidth > 100) {
                log('Auto-closing navigation sidebar...');
                navBtn.click();
            }
        },

        collapseHistory() {
            const buttons = Array.from(document.querySelectorAll('button:not([disabled])'));
            const historyButtons = buttons.filter(b =>
                (b.classList.contains('history-button') && (b.classList.contains('expanded') || b.getAttribute('aria-expanded') === 'true')) ||
                (b.getAttribute('aria-expanded') === 'true' && (b.textContent.toLowerCase().includes('today') || b.textContent.toLowerCase().includes('yesterday') || b.textContent.toLowerCase().includes('previous')))
            );

            if (historyButtons.length > 0) {
                historyButtons.forEach((el, index) => {
                    log(`Collapsing history button #${index}`, el);
                    el.click();
                });
            }
        },

        // --- Model Logic ---
        async applyModel(modelKey) {
            if (!modelKey) return;
            const modelConfig = typeof BAS_CONFIG !== 'undefined' ? BAS_CONFIG.models?.[modelKey] : null;
            if (!modelConfig) return;

            const targetId = this.normalizeLabel(modelConfig.uiId || modelConfig.id || modelConfig.name || modelKey);
            const targetLabel = this.normalizeLabel(modelConfig.uiLabel || modelConfig.name || modelKey);

            const runSettingsRoot = document.querySelector('ms-run-settings') ||
                Array.from(document.querySelectorAll('h2, [role="heading"]')).find(el => this.normalizeLabel(el.textContent) === 'run settings')?.parentElement ||
                document.body;

            const currentBtn = Array.from(runSettingsRoot.querySelectorAll('button')).find(btn => {
                const text = this.normalizeLabel(btn.textContent);
                return text.includes('gemini') || text.includes('nano') || text.includes('imagen') || text.includes('veo');
            });

            if (!currentBtn) return;

            const currentText = this.normalizeLabel(currentBtn.textContent);
            if (currentText.includes(targetId) || currentText.includes(targetLabel)) {
                log(`Model match confirmed (${modelKey}). No switch needed.`);
                return;
            }

            currentBtn.click();

            return new Promise(resolve => {
                const check = () => {
                    const options = Array.from(document.querySelectorAll('button, mat-list-item, [role="option"]'));
                    const target = options.find(el => {
                        const text = this.normalizeLabel(el.textContent);
                        return text.includes(targetId) || text.includes(targetLabel);
                    });

                    if (target) {
                        target.click();
                        resolve();
                    } else {
                        requestAnimationFrame(check);
                    }
                };
                check();
                setTimeout(resolve, 1500);
            });
        },

        // --- Params (Sliders) ---
        applyParameters(config) {
            const params = [
                { label: 'Temperature', value: config.temp },
                { label: 'Top P', value: config.topP },
                { label: 'Top K', value: config.topK },
                { label: 'Output length', value: config.maxTokens, aria: 'Maximum output tokens' },
                { label: 'Thinking level', value: config.thinkingLevel },
                { label: 'Aspect Ratio', value: config.aspectRatio },
                { label: 'Media resolution', value: config.resolution }
            ];

            params.forEach(p => {
                if (p.value === undefined || p.value === null) return;

                if (p.label === 'Top P' || p.label === 'Top K' || p.label === 'Output length') {
                    this.ensureAdvancedExpanded();
                }

                const input = this.findSliderInput(p.label, p.aria);
                if (input) {
                    this.setNumericValue(input, p.value);
                    return;
                }

                const select = this.findSelectInput(p.label);
                if (select) {
                    const trigger = select.matches('mat-select, .mat-mdc-select, select, [role="combobox"], button') ?
                        select :
                        select.querySelector('mat-select, .mat-mdc-select, [role="combobox"], button, select');
                    if (trigger) trigger.click();

                    setTimeout(() => {
                        const option = Array.from(document.querySelectorAll('mat-option, [role="option"]')).find(opt => opt.textContent.trim() === p.value);
                        if (option) option.click();
                        else document.body.click();
                    }, 50);
                }
            });

            this.applyStopSequences(config.stopSequences);
            this.applySafetySettings(config.safetySettings);
        },

        applyStopSequences(stopSequences) {
            if (stopSequences === undefined || stopSequences === null) return;
            if (this.lastStopSequences === stopSequences) return;
            this.lastStopSequences = stopSequences;
            this.ensureAdvancedExpanded();
            const input = this.findStopSequenceInput();
            if (!input) return;

            const sequences = stopSequences
                .split(/\n|,/)
                .map(seq => seq.trim())
                .filter(Boolean);

            if (!sequences.length) return;

            const existing = this.getExistingStopSequences(input);
            sequences.forEach(seq => {
                if (existing.has(seq)) return;
                input.value = seq;
                this.dispatch(input);
                this.dispatchKey(input, 'Enter');
                input.value = '';
            });
        },

        findStopSequenceInput() {
            return document.querySelector('input[aria-label*="stop" i], input[placeholder*="stop" i], textarea[aria-label*="stop" i], textarea[placeholder*="stop" i]');
        },

        getExistingStopSequences(input) {
            const container = input.closest('div') || document.body;
            const tokens = Array.from(container.querySelectorAll('mat-chip, .mdc-evolution-chip__text-label, .chip, [role="listitem"], .token'));
            return new Set(tokens.map(token => (token.textContent || '').trim()).filter(Boolean));
        },

        dispatchKey(target, key) {
            if (!target) return;
            target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
            target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
        },

        applySafetySettings(settings = {}) {
            if (!settings || Object.keys(settings).length === 0) return;
            if (Date.now() - this.lastInteraction < 2000) return;
            const serialized = JSON.stringify(settings);
            if (this.lastSafetySettings === serialized || this.isApplyingSafety) return;
            this.lastSafetySettings = serialized;
            this.isApplyingSafety = true;

            let editButton = Array.from(document.querySelectorAll('button')).find(btn => {
                const text = this.normalizeLabel(btn.textContent);
                const aria = this.normalizeLabel(btn.getAttribute('aria-label'));
                return text.includes('edit safety') || aria.includes('edit safety');
            });

            if (!editButton) {
                const safetyHeading = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"], div, span'))
                    .find(el => this.normalizeLabel(el.textContent).includes('safety settings'));
                if (safetyHeading) {
                    const row = safetyHeading.closest('section, div') || safetyHeading.parentElement;
                    if (row) editButton = row.querySelector('button');
                }
            }

            if (!editButton) {
                this.isApplyingSafety = false;
                return;
            }
            editButton.click();

            setTimeout(() => {
                const modal = Array.from(document.querySelectorAll('div, section, ms-run-settings, ms-run-safety-settings'))
                    .find(el => this.normalizeLabel(el.textContent).includes('run safety settings')) || document.body;

                const targets = [
                    { key: 'harassment', label: 'Harassment' },
                    { key: 'hate', label: 'Hate' },
                    { key: 'sexuallyExplicit', label: 'Sexually Explicit' },
                    { key: 'dangerousContent', label: 'Dangerous Content' }
                ];

                const valueMap = {
                    OFF: 'off',
                    BLOCK_NONE: 'block none',
                    BLOCK_ONLY_HIGH: 'block only high',
                    BLOCK_MEDIUM_AND_ABOVE: 'block medium',
                    BLOCK_LOW_AND_ABOVE: 'block low'
                };

                targets.forEach(target => {
                    const desired = valueMap[settings[target.key]] || this.normalizeLabel(settings[target.key]);
                    if (!desired) return;

                    const labelNode = Array.from(modal.querySelectorAll('div, span, label, h3'))
                        .find(el => this.normalizeLabel(el.textContent) === this.normalizeLabel(target.label));
                    if (!labelNode) return;

                    const row = labelNode.closest('div') || labelNode.parentElement;
                    const slider = row ? (row.querySelector('input[type="range"], [role="slider"]')) : null;
                    if (!slider) return;

                    const min = parseFloat(slider.min || slider.getAttribute('aria-valuemin') || '0');
                    const max = parseFloat(slider.max || slider.getAttribute('aria-valuemax') || '4');
                    const steps = ['off', 'block none', 'block only high', 'block medium', 'block low'];
                    const idx = Math.max(0, steps.findIndex(step => desired.includes(step)));
                    const value = min + ((max - min) / (steps.length - 1)) * idx;
                    slider.value = value;
                    this.dispatch(slider);
                });

                const closeBtn = Array.from(modal.querySelectorAll('button')).find(btn => {
                    const text = this.normalizeLabel(btn.textContent);
                    const aria = this.normalizeLabel(btn.getAttribute('aria-label'));
                    return text.includes('close run safety') || aria.includes('close run safety') || aria.includes('close');
                });
                if (closeBtn) closeBtn.click();
                this.isApplyingSafety = false;
            }, 200);
        },

        findSelectInput(label) {
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'));
            const targetHeading = headings.find(el => this.normalizeLabel(el.textContent).includes(this.normalizeLabel(label)));
            if (targetHeading) {
                const container = targetHeading.closest('section, div, ms-run-settings') || targetHeading.parentElement;
                if (container) {
                    const sel = container.querySelector('mat-select, .mat-mdc-select, select, [role="combobox"], button[aria-haspopup="listbox"]');
                    if (sel) return sel;
                }
            }

            const labels = Array.from(document.querySelectorAll('.label-wrapper, span, label'));
            const target = labels.find(el => el.textContent.trim().toLowerCase().includes(label.toLowerCase()));
            if (target) {
                let p = target.parentElement;
                for (let i = 0; i < 5; i++) {
                    if (!p) break;
                    const sel = p.querySelector('mat-select, .mat-mdc-select, select, [role="combobox"], button[aria-haspopup="listbox"]');
                    if (sel) return sel;
                    p = p.parentElement;
                }
            }
            return null;
        },

        findSliderInput(label, aria) {
            if (aria) {
                const el = document.querySelector(`input[aria-label="${aria}"]`);
                if (el) return el;
            }

            const headings = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'));
            const targetHeading = headings.find(el => this.normalizeLabel(el.textContent).includes(this.normalizeLabel(label)));

            if (targetHeading) {
                const container = targetHeading.closest('section, div, ms-run-settings') || targetHeading.parentElement;
                if (container) {
                    const spin = container.querySelector('input[role="spinbutton"], input[type="number"], input.slider-number-input');
                    if (spin) return spin;
                    const slider = container.querySelector('input[type="range"], [role="slider"]');
                    if (slider) return slider;
                }
            }

            const labels = Array.from(document.querySelectorAll('.label-wrapper, span, label'));
            const target = labels.find(el => el.textContent.trim().toLowerCase().includes(label.toLowerCase()));
            if (target) {
                let p = target.parentElement;
                for (let i = 0; i < 5; i++) {
                    if (!p) break;
                    const inp = p.querySelector('input.slider-number-input');
                    if (inp) return inp;
                    p = p.parentElement;
                }
            }
            return null;
        },

        setNumericValue(input, value) {
            if (!input) return;
            const numericValue = parseFloat(value);
            if (isNaN(numericValue)) return;
            if (input.value != numericValue) {
                input.value = numericValue;
                this.dispatch(input);
            }
        },


        normalizeLabel(text) {
            return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
        },

        getToggleLabel(toggle) {
            const aria = toggle?.getAttribute('aria-label');
            if (aria) return this.normalizeLabel(aria);

            const container = toggle?.closest('mat-slide-toggle, .mat-mdc-slide-toggle, .mdc-form-field, .toggle-row, .setting-row, .settings-item, ms-run-settings') ||
                toggle?.parentElement;
            if (!container) return '';
            return this.normalizeLabel(container.textContent);
        },

        findToolToggle(labels, selectors = []) {
            const normalizedSelectors = selectors.filter(Boolean);

            const findBySelector = (selector) => {
                const el = document.querySelector(selector);
                if (!el) return null;
                if (el.matches('[role="switch"]')) return el;
                return el.querySelector('[role="switch"]') || el.querySelector('button') || null;
            };

            for (const selector of normalizedSelectors) {
                const match = findBySelector(selector);
                if (match) return match;
            }

            const toggles = Array.from(document.querySelectorAll('[role="switch"]'));
            const normalizedLabels = labels.map(label => this.normalizeLabel(label));
            return toggles.find(toggle => {
                const labelText = this.getToggleLabel(toggle);
                return normalizedLabels.some(label => labelText.includes(label));
            }) || null;
        },

        findSchemaEditButton(toggle, labelHints = []) {
            const container = toggle?.closest('mat-slide-toggle, .mat-mdc-slide-toggle, .mdc-form-field, .toggle-row, .setting-row, .settings-item') ||
                toggle?.parentElement ||
                document;
            const candidates = Array.from(container.querySelectorAll('button'));
            const normalizedHints = labelHints.map(label => this.normalizeLabel(label));

            const isMatch = (btn) => {
                const aria = this.normalizeLabel(btn.getAttribute('aria-label'));
                const title = this.normalizeLabel(btn.getAttribute('title'));
                const text = this.normalizeLabel(btn.textContent);
                const icon = this.normalizeLabel(btn.getAttribute('iconname'));
                const testId = this.normalizeLabel(btn.getAttribute('data-test-id'));
                const combined = `${aria} ${title} ${text} ${testId}`.trim();

                if (icon === 'edit' || icon === 'create') {
                    if (normalizedHints.length === 0) return true;
                    return normalizedHints.some(hint => combined.includes(hint)) || normalizedHints.some(hint => icon.includes(hint));
                }

                if (!combined) return false;
                if (combined.includes('edit')) {
                    if (normalizedHints.length === 0) return true;
                    return normalizedHints.some(hint => combined.includes(hint));
                }
                return combined.includes('schema') || combined.includes('structured') || combined.includes('function');
            };

            return candidates.find(isMatch) || null;
        },

        ensureToolsExpanded() {
            const hasToggles = document.querySelectorAll('[role="switch"]').length > 0;
            if (hasToggles) return;

            const toggleBtn = Array.from(document.querySelectorAll('button')).find(btn => {
                const label = this.normalizeLabel(btn.getAttribute('aria-label'));
                return label.includes('expand or collapse tools');
            });

            if (toggleBtn) toggleBtn.click();
        },

        ensureAdvancedExpanded() {
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'));
                const hasAdvanced = headings.some(el => {
                    const text = this.normalizeLabel(el.textContent);
                    return text.includes('top p') || text.includes('top k') || text.includes('output length') || text.includes('max output tokens');
                });
            if (hasAdvanced) return;

            const advancedBtn = Array.from(document.querySelectorAll('button')).find(btn => {
                const label = this.normalizeLabel(btn.getAttribute('aria-label'));
                return label.includes('expand or collapse advanced settings');
            });

            if (advancedBtn) advancedBtn.click();
        },

        // --- Tools (Toggles & Modals) ---
        async applyTools(config) {
            const toolMap = [
                {
                    key: 'search',
                    labels: ['Grounding with Google Search', 'Google Search', 'Search'],
                    selectors: [
                        'div[data-test-id="searchAsAToolTooltip"] button',
                        'div[data-test-id="searchAsAToolTooltip"] [role="switch"]',
                        '.search-as-a-tool-toggle button'
                    ]
                },
                {
                    key: 'url',
                    labels: ['Browse the url context', 'Browse the URL context', 'URL context', 'Browse URL', 'Browse as a Tool'],
                    selectors: [
                        'div[data-test-id="browseAsAToolTooltip"] button',
                        'div[data-test-id="browseAsAToolTooltip"] [role="switch"]',
                        'ms-browse-as-a-tool mat-slide-toggle button',
                        'ms-browse-as-a-tool [role="switch"]'
                    ]
                },
                {
                    key: 'code',
                    labels: ['Code execution', 'Code Execution', 'Code'],
                    selectors: ['.code-execution-toggle button', '.code-execution-toggle [role="switch"]']
                },
                {
                    key: 'structured',
                    labels: ['Structured outputs', 'Structured output', 'Structured'],
                    selectors: ['.structured-output-toggle button', '.structured-output-toggle [role="switch"]'],
                    schema: config.structuredSchema,
                    schemaHints: ['structured', 'schema']
                },
                {
                    key: 'functions',
                    labels: ['Function calling', 'Function Calling', 'Functions', 'Function'],
                    selectors: ['.function-calling-toggle button', '.function-calling-toggle [role="switch"]'],
                    schema: config.functionsSchema,
                    schemaHints: ['function', 'schema']
                }
            ];

            this.ensureToolsExpanded();

            for (const tool of toolMap) {
                if (config[tool.key] === undefined) continue;
                const toggle = this.findToolToggle(tool.labels, tool.selectors);
                if (!toggle) continue;

                if (toggle.getAttribute('aria-disabled') === 'true' || toggle.hasAttribute('disabled')) continue;

                const isActive = toggle.getAttribute('aria-checked') === 'true' || toggle.classList.contains('mdc-switch--checked');
                if (isActive !== !!config[tool.key]) {
                    toggle.click();
                }

                if (config[tool.key] && tool.schema) {
                    await this.injectSchema(toggle, tool.schema, tool.schemaHints);
                }
            }
        },



        async injectSchema(toggle, schema, labelHints = []) {
            const editBtn = await this.waitForSchemaButton(toggle, labelHints);
            if (!editBtn) return;

            editBtn.click();
            await this.waitForModalAndInject(schema);
        },

        waitForSchemaButton(toggle, labelHints = []) {
            return new Promise(resolve => {
                const started = Date.now();
                const check = () => {
                    const btn = this.findSchemaEditButton(toggle, labelHints);
                    if (btn) {
                        const disabled = btn.getAttribute('aria-disabled') === 'true' || btn.hasAttribute('disabled');
                        if (!disabled) {
                            resolve(btn);
                            return;
                        }
                    }
                    if (Date.now() - started > 2000) {
                        resolve(null);
                        return;
                    }
                    requestAnimationFrame(check);
                };
                check();
            });
        },


        waitForModalAndInject(schema) {
            return new Promise(resolve => {
                const check = () => {
                    const modal = document.querySelector('mat-dialog-container, .mat-mdc-dialog-container, .cdk-overlay-pane mat-dialog-container, .cdk-overlay-pane .mat-mdc-dialog-container');
                    if (modal) {
                        let textarea = modal.querySelector('textarea:not(.monaco-mouse-cursor-text)') ||
                            modal.querySelector('textarea');

                        if (!textarea) {
                            const monacoInput = modal.querySelector('.monaco-editor textarea.inputarea');
                            if (monacoInput) textarea = monacoInput;
                        }

                        if (textarea) {
                            textarea.focus();
                            textarea.value = schema;
                            this.dispatch(textarea);
                            // Correct selectors for modal close/save
                            const doneBtn = Array.from(modal.querySelectorAll('button')).find(b => {
                                const label = (b.getAttribute('aria-label') || '').toLowerCase();
                                const text = b.textContent.toLowerCase();
                                return label === 'close' || label.includes('save') || label.includes('done') || label.includes('apply') ||
                                    text.includes('done') || text.includes('apply') || text.includes('save');
                            });
                            if (doneBtn) doneBtn.click();
                            resolve();
                        } else {
                            requestAnimationFrame(check);
                        }
                    } else {
                        requestAnimationFrame(check);
                    }
                };
                check();
                setTimeout(resolve, 3000);
            });
        },

        // --- Instructions ---
        async applyInstructions(text, config = {}) {
            if (text === undefined) return;
            const trigger = document.querySelector('button[aria-label="System instructions"]');
            if (!trigger) return;

            let textarea = document.querySelector('textarea[aria-label="System instructions"]');
            const wasOpen = !!textarea;

            if (!wasOpen) {
                trigger.click();
                await new Promise(resolve => {
                    let attempts = 0;
                    const check = () => {
                        textarea = document.querySelector('textarea[aria-label="System instructions"]');
                        if (textarea || attempts > 50) resolve();
                        else { attempts++; requestAnimationFrame(check); }
                    };
                    check();
                });
            }

            if (textarea && textarea.value !== text) {
                textarea.value = text;
                this.dispatch(textarea);
            }

            // Always attempt to close if it's open, or if we just opened it (Fire & Forget)
            this.ensurePanelsClosed(config);
        },

        // --- Aggressive Cleanup ---
        async ensurePanelsClosed(config = {}) {
            await new Promise(r => requestAnimationFrame(r));
            const shouldCloseSettings = config.autoCloseSettings !== false;

            for (let i = 0; i < 10; i++) {
                const closeSelectors = [
                    'button[aria-label="Close panel"]',
                    'button[aria-label="close"]',
                    'button[aria-label="Close"]',
                    'button[aria-label="Close run settings panel"]',
                    '.cdk-overlay-backdrop'
                ];

                if (shouldCloseSettings) {
                    // Aggressive: if ms-run-settings is still expanded, try to find its toggle/close
                    const runSettings = document.querySelector('ms-run-settings.expanded') ||
                        document.querySelector('ms-run-settings[aria-expanded="true"]') ||
                        document.querySelector('ms-run-settings');
                    if (runSettings) {
                        const closeBtn = runSettings.querySelector('button[aria-label*="Close"], button[aria-label*="Toggle"]');
                        if (closeBtn) closeBtn.click();
                    }
                }


                let closedAny = false;
                closeSelectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(btn => {
                        if (sel === '.cdk-overlay-backdrop') {
                            btn.click();
                            closedAny = true;
                            return;
                        }

                        // Safeguard: Don't close settings panel via generic button if user wants it open
                        if (!shouldCloseSettings && btn.closest('ms-run-settings')) {
                            return;
                        }

                        btn.click();
                        closedAny = true;
                    });
                });

                // Final check for System Instructions specifically
                const sysInstr = document.querySelector('ms-system-instructions');
                if (sysInstr) {
                    const closeBtn = sysInstr.querySelector('button[aria-label*="Close"]');
                    if (closeBtn) {
                        closeBtn.click();
                        closedAny = true;
                    }
                }

                if (!closedAny && !document.querySelector('.cdk-overlay-pane')) break;
                await new Promise(r => setTimeout(r, 100));
            }
        },

        // --- Utils ---
        dispatch(el) {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        },

        setupListeners() {
            // Detect user interaction with a timestamp for smart throttling
            const recordInteraction = () => {
                this.lastInteraction = Date.now();
                if (this.isStabilizing) {
                    log('Stopping stabilization due to interaction');
                    this.isStabilizing = false;
                }
            };

            window.addEventListener('mousedown', recordInteraction, { capture: true, passive: true });
            window.addEventListener('keydown', recordInteraction, { capture: true, passive: true });
            window.addEventListener('touchstart', recordInteraction, { capture: true, passive: true });

            // Detect manual sidebar toggle to respect user expansion
            document.addEventListener('mousedown', (e) => {
                const toggle = e.target.closest('button[aria-label="Toggle navigation menu"]');
                if (toggle && e.isTrusted) {
                    // User is interacting: Set intent to TRUE. 
                    this.isManualSidebarOpen = true;
                    log('User interacting with sidebar toggle (Manual Override ON)');
                    this.lastInteraction = Date.now();
                }
            }, true);

            chrome.storage.onChanged.addListener(changes => {
                // Skip if user recently interacted (avoid flicker on their actions)
                if (Date.now() - this.lastInteraction < 2000) return;
                if (changes.modelSettings) this.modelSettings = changes.modelSettings.newValue || {};
                if (changes.config) this.apply(changes.config.newValue);
            });
            const channel = new BroadcastChannel('bas_mirror_sync');
            channel.onmessage = e => {
                // Skip if user recently interacted
                if (Date.now() - this.lastInteraction < 2000) return;
                if (e.data?.type === 'MIRROR_HEARTBEAT') this.apply(e.data.state.config);
            };
        },

        loadAndApply() {
            chrome.storage.local.get(['config', 'modelSettings'], res => {
                this.modelSettings = res.modelSettings || {};
                if (res.config) this.apply(res.config);
            });
        },

        setupObserver() {
            const observer = new MutationObserver(mutations => {
                const hasRelevantChange = mutations.some(m =>
                    m.addedNodes.length > 0 && Array.from(m.addedNodes).some(node =>
                        node.nodeType === 1 && (
                            node.matches('mat-drawer') ||
                            node.matches('mat-drawer') ||
                            node.querySelector('.settings-container') ||
                            node.matches('ms-playground') ||
                            node.querySelector('ms-playground') ||
                            (node.classList && node.classList.contains('history-button')) ||
                            node.querySelector('.history-button')
                        )
                    )
                );
                if (hasRelevantChange) {
                    // Skip if user recently interacted
                    if (Date.now() - this.lastInteraction < 2000) return;
                    log('Relevant DOM change detected, re-applying...');
                    this.loadAndApply();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        },

        setupModelObserver() {
            // Listen for clicks on the Model Menu Items
            document.addEventListener('click', (e) => {
                if (!e.isTrusted) return; // Ignore programmatic clicks

                const target = e.target;
                // Check if clicking "Playground" (View Reset)
                if (target.matches('button[aria-label="Playground"]') || target.textContent.includes('Playground')) {
                    log('Playground clicked (Soft Navigation) - Scheduling re-apply');
                    setTimeout(() => this.loadAndApply(), 500);
                    setTimeout(() => this.loadAndApply(), 1500);
                }

                // Check if clicking a model option
                const option = target.closest('mat-list-item[role="option"], [role="option"]');
                if (option) {
                    const text = option.textContent.toLowerCase();
                    let newModelId = null;
                    if (text.includes('pro')) newModelId = 'gemini-3-pro';
                    else if (text.includes('flash')) newModelId = 'gemini-3-flash';
                    else if (text.includes('nano')) newModelId = 'nano-banana-pro';

                    if (newModelId && this.currentConfig && this.currentConfig.model !== newModelId) {
                        log(`User switched model on page to: ${newModelId}`);
                        this.userJustSwitchedModel = true; // Optimization flag
                        this.handleModelSwitch(newModelId);
                    }
                }
            }, true);
        },

        handleModelSwitch(newModelId) {
            // 1. Get settings for new model from cached modelSettings
            const settings = this.modelSettings?.[newModelId] || {};
            const modelDefaults = (typeof BAS_CONFIG !== 'undefined' ? BAS_CONFIG.models?.[newModelId]?.defaults : null) || BAS_CONFIG?.presets?.default || {};
            const fallback = (key, value) => settings[key] !== undefined ? settings[key] : (modelDefaults[key] !== undefined ? modelDefaults[key] : value);

            // 2. Default fallback
            // We need to construct a full config object to save to storage
            // We use the current config as base, but overwrite params
            const newConfig = {
                ...this.currentConfig,
                model: newModelId,
                search: fallback('search', true),
                url: fallback('url', true),
                code: fallback('code', false),
                structured: fallback('structured', false),
                structuredSchema: fallback('structuredSchema', ""),
                functions: fallback('functions', false),
                functionsSchema: fallback('functionsSchema', ""),
                temp: fallback('temp', "0.70"),
                topP: fallback('topP', "0.95"),
                topK: fallback('topK', "40"),
                maxTokens: fallback('maxTokens', "65536"),
                thinkingLevel: fallback('thinkingLevel', "High"),
                stopSequences: fallback('stopSequences', ""),
                safetySettings: fallback('safetySettings', {}),
                instructions: fallback('instructions', ""),
                aspectRatio: fallback('aspectRatio', "1:1"),
                resolution: fallback('resolution', "Default")
            };

            // 3. Save to storage (no echo needed, user already changed model)
            chrome.storage.local.set({ config: newConfig }, () => {
                log('Model switch saved to storage');
                // DO NOT call apply() - user already changed the model on page
                // Just update our internal reference
                this.currentConfig = newConfig;
            });
        },

        setupNavigationListener() {
            let lastUrl = location.href;
            setInterval(() => {
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    log('URL changed, re-applying sync...');
                    this.loadAndApply();
                }
            }, 500);
        }
    };

    BAS_Sync.init();
})();
