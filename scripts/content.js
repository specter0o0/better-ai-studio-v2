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

        async apply(config) {
            if (this.isApplying || (config && config.disable)) {
                log('Skipped apply:', this.isApplying ? 'already applying' : 'disabled');
                return;
            }
            config = config || {};
            this.isApplying = true;

            // Dynamic suppression based on preferences
            this.updateSuppression(config);
            this.toggleSuppression(true);

            log('Starting Atomic Sync with config:', JSON.stringify({
                autoCloseNav: config.autoCloseNav,
                hideEmail: config.hideEmail,
                model: config.model
            }));

            try {
                // 1. Model Selection
                await this.applyModel(config.model);

                // 2. Tools & Params
                await this.applyParameters(config);
                await this.applyTools(config);

                // 3. System Instructions
                await this.applyInstructions(config.instructions, config);

                // 4. UI Adjustments
                this.applyUIAjustments(config);

            } catch (err) {
                log('Sync Error:', err);
            } finally {
                // Critical: Ensure EVERYTHING is closed before lifting suppression
                await this.ensurePanelsClosed(config);
                this.toggleSuppression(false);
                this.isApplying = false;
                log('Atomic Sync Complete (Seamless)');
            }
        },

        applyUIAjustments(config) {
            // Class-based adjustments for zero flicker (only for PII hiding)
            document.body.classList.toggle('bas-hide-email', config.hideEmail !== false);

            if (config.hideEmail !== false) this.hideEmail();
            if (config.collapseHistory !== false) this.collapseHistory();

            // Immediate Sidebar Collapse (if enabled and no manual override)
            log(`autoCloseNav check: config.autoCloseNav=${config.autoCloseNav}, isManualSidebarOpen=${this.isManualSidebarOpen}`);
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
            const currentBtn = document.querySelector('button.model-selector-card') ||
                Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Gemini'));

            if (currentBtn && !currentBtn.textContent.toLowerCase().includes(modelKey.replace(/-/g, ' '))) {
                currentBtn.click();

                // Fast poll for popover
                return new Promise(resolve => {
                    const check = () => {
                        const target = document.querySelector(`[id*="${modelKey}"]`) ||
                            Array.from(document.querySelectorAll('mat-list-item, [role="option"]')).find(el => el.textContent.toLowerCase().includes(modelKey.replace(/-/g, ' ')));
                        if (target) {
                            target.click();
                            resolve();
                        } else {
                            requestAnimationFrame(check);
                        }
                    };
                    check();
                    setTimeout(resolve, 1000); // Safety timeout
                });
            }
        },

        // --- Params (Sliders) ---
        applyParameters(config) {
            const params = [
                { label: 'Temperature', value: config.temp },
                { label: 'Top P', value: config.topP },
                { label: 'Output length', value: config.maxTokens, aria: 'Maximum output tokens' },
                { label: 'Aspect Ratio', value: config.aspectRatio },
                { label: 'Resolution', value: config.resolution }
            ];

            params.forEach(p => {
                if (p.value === undefined || p.value === null) return;

                // Try slider first
                const input = this.findSliderInput(p.label, p.aria);
                if (input) {
                    // Fix: Ensure value is numeric for slider to prevent "Low" etc crashing the sync
                    const numericValue = parseFloat(p.value);
                    if (!isNaN(numericValue) && input.value != numericValue) {
                        input.value = numericValue;
                        this.dispatch(input);
                    }
                    return;
                }

                // Try select
                const select = this.findSelectInput(p.label);
                if (select) {
                    // This is for Nano settings which might be selects or custom dropdowns
                    // We'll try to find an option that matches the value
                    const trigger = select.querySelector('mat-select, .mat-mdc-select, button');
                    if (trigger) trigger.click();

                    setTimeout(() => {
                        const option = Array.from(document.querySelectorAll('mat-option, [role="option"]')).find(opt => opt.textContent.trim() === p.value);
                        if (option) option.click();
                        else document.body.click(); // Close if not found
                    }, 50);
                }
            });
        },

        findSelectInput(label) {
            const labels = Array.from(document.querySelectorAll('.label-wrapper, span, label'));
            const target = labels.find(el => el.textContent.trim().toLowerCase().includes(label.toLowerCase()));
            if (target) {
                let p = target.parentElement;
                for (let i = 0; i < 5; i++) {
                    if (!p) break;
                    const sel = p.querySelector('mat-select, .mat-mdc-select, select');
                    if (sel) return p; // Return parent container
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

        // --- Tools (Toggles & Modals) ---
        async applyTools(config) {
            const toolMap = [
                { key: 'search', label: 'Grounding with Google Search' },
                { key: 'url', label: 'Browse the url context' },
                { key: 'code', label: 'Code execution' },
                { key: 'structured', label: 'Structured outputs', schema: config.structuredSchema },
                { key: 'functions', label: 'Function calling', schema: config.functionsSchema }
            ];

            for (const tool of toolMap) {
                if (config[tool.key] === undefined) continue;
                const toggle = document.querySelector(`button[aria-label="${tool.label}"][role="switch"]`);
                if (!toggle) continue;

                const isActive = toggle.getAttribute('aria-checked') === 'true' || toggle.classList.contains('mdc-switch--checked');
                if (isActive !== !!config[tool.key]) {
                    toggle.click();
                }

                if (config[tool.key] && tool.schema) {
                    await this.injectSchema(toggle, tool.schema);
                }
            }
        },

        async injectSchema(toggle, schema) {
            let parent = toggle.parentElement;
            for (let i = 0; i < 4; i++) {
                if (!parent) break;
                const editBtn = parent.querySelector('button.ms-button-borderless, .edit-function-declarations-button');
                if (editBtn) {
                    editBtn.click();
                    await this.waitForModalAndInject(schema);
                    break;
                }
                parent = parent.parentElement;
            }
        },

        waitForModalAndInject(schema) {
            return new Promise(resolve => {
                const check = () => {
                    const modal = document.querySelector('mat-dialog-container');
                    if (modal) {
                        const textarea = modal.querySelector('textarea:not(.monaco-mouse-cursor-text)');
                        if (textarea) {
                            textarea.value = schema;
                            this.dispatch(textarea);
                            // Correct selectors for modal close/save
                            const doneBtn = Array.from(modal.querySelectorAll('button')).find(b => {
                                const label = (b.getAttribute('aria-label') || '').toLowerCase();
                                const text = b.textContent.toLowerCase();
                                return label === 'close' || label.includes('save') || text.includes('done') || text.includes('apply');
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

            // Always attempt to close if it's open, or if we just opened it
            await this.ensurePanelsClosed(config);
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
                    '.cdk-overlay-backdrop'
                ];

                if (shouldCloseSettings) {
                    closeSelectors.push('button[aria-label="Close run settings panel"]');
                    // Aggressive: if ms-run-settings is still expanded, try to find its toggle/close
                    const runSettings = document.querySelector('ms-run-settings.expanded');
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
                if (changes.config) this.apply(changes.config.newValue);
            });
            const channel = new BroadcastChannel('bas_mirror_sync');
            channel.onmessage = e => {
                if (e.data?.type === 'MIRROR_HEARTBEAT') this.apply(e.data.state.config);
            };
        },

        loadAndApply() {
            chrome.storage.local.get(['config'], res => {
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
                    log('Relevant DOM change detected, re-applying...');
                    this.loadAndApply();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
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
