/**
 * Better AI Studio - Centralized Configuration
 * Everything must be consistent.
 */

const BAS_CONFIG = {
  theme: {
    colors: {
      background: '#0d0d0d',
      cardBg: '#1a1a1a',
      cardHover: '#242424',
      text: '#efefef',
      textMuted: '#9a9a9a',
      accent: '#ffffff',
      border: 'rgba(255, 255, 255, 0.1)',
      sidebarActive: '#1e1e1e'
    },
    spacing: {
      gap: '12px',
      padding: '16px',
      radius: '12px'
    },
    font: 'Inter, system-ui, -apple-system, sans-serif'
  },
  settings: {
    autoCloseNav: true,
    autoCloseSettings: true,
    collapseHistory: true,
    hideEmail: true
  },
  presets: {
    default: {
      name: 'Default',
      instructions: '',
      search: false,
      url: false,
      code: false,
      structured: false,
      functions: false,
      temp: "1.00",
      topP: "0.95",
      maxTokens: "2048"
    }
  },
  models: {
    'gemini-3-pro': {
      name: 'Gemini 3 Pro',
      id: 'models/gemini-3-pro-preview',
      tempRange: { min: 0, max: 2, step: 0.05 },
      capabilities: { search: true, code: true, functions: true, structured: true, url: true }
    },
    'gemini-3-flash': {
      name: 'Gemini 3 Flash',
      id: 'models/gemini-3-flash-preview',
      tempRange: { min: 0, max: 2, step: 0.05 },
      capabilities: { search: true, code: true, functions: true, structured: true, url: true }
    },
    'gemini-2.5-pro': {
      name: 'Gemini 2.5 Pro',
      id: 'models/gemini-2.5-pro-preview',
      tempRange: { min: 0, max: 2, step: 0.05 },
      capabilities: { search: true, code: true, functions: true, structured: true, url: true }
    },
    'nano-banana-pro': {
      name: 'Nano Banana Pro',
      id: 'models/gemini-3-pro-image-preview',
      tempRange: { min: 0, max: 1, step: 0.01 },
      capabilities: { search: false, code: false, functions: false, structured: false, url: false, aspectRatio: true, resolution: true }
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports = BAS_CONFIG;
}
