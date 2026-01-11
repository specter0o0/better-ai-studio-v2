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
      structuredSchema: "",
      functions: false,
      functionsSchema: "",
      temp: "1.00",
      topP: "0.95",
      topK: "40",
      maxTokens: "65536",
      thinkingLevel: "High",
      stopSequences: "",
      safetySettings: {
        harassment: "OFF",
        hate: "OFF",
        sexuallyExplicit: "OFF",
        dangerousContent: "OFF"
      },
      aspectRatio: "1:1",
      resolution: "Default"
    }
  },
  models: {
    'gemini-3-pro': {
      name: 'Gemini 3 Pro Preview',
      id: 'models/gemini-3-pro-preview',
      uiId: 'gemini-3-pro-preview',
      uiLabel: 'Gemini 3 Pro Preview',
      tempRange: { min: 0, max: 2, step: 0.05 },
      topPRange: { min: 0, max: 1, step: 0.01 },
      maxTokensRange: { min: 1, max: 65536, step: 1 },
      topKRange: { min: 1, max: 100, step: 1 },
      capabilities: { search: true, url: true, code: true, functions: true, structured: true, thinkingLevel: true, topK: true, stopSequences: true, safetySettings: true },
      defaults: { temp: '1.00', topP: '0.95', topK: '40', maxTokens: '65536', search: true, url: true, code: false, structured: false, structuredSchema: "", functions: false, functionsSchema: "", instructions: "", thinkingLevel: "High", stopSequences: "", safetySettings: { harassment: "OFF", hate: "OFF", sexuallyExplicit: "OFF", dangerousContent: "OFF" } }
    },
    'gemini-3-flash': {
      name: 'Gemini 3 Flash Preview',
      id: 'models/gemini-3-flash-preview',
      uiId: 'gemini-3-flash-preview',
      uiLabel: 'Gemini 3 Flash Preview',
      tempRange: { min: 0, max: 2, step: 0.05 },
      topPRange: { min: 0, max: 1, step: 0.01 },
      maxTokensRange: { min: 1, max: 65536, step: 1 },
      topKRange: { min: 1, max: 100, step: 1 },
      capabilities: { search: true, url: true, code: true, functions: true, structured: true, thinkingLevel: true, topK: true, stopSequences: true, safetySettings: true },
      defaults: { temp: '0.70', topP: '0.95', topK: '40', maxTokens: '65536', search: true, url: true, code: false, structured: false, structuredSchema: "", functions: false, functionsSchema: "", instructions: "", thinkingLevel: "High", stopSequences: "", safetySettings: { harassment: "OFF", hate: "OFF", sexuallyExplicit: "OFF", dangerousContent: "OFF" } }
    },
    'nano-banana-pro': {
      name: 'Nano Banana Pro',
      id: 'models/gemini-3-pro-image-preview',
      uiId: 'gemini-3-pro-image-preview',
      uiLabel: 'Nano Banana Pro',
      tempRange: { min: 0, max: 1, step: 0.01 },
      topPRange: { min: 0, max: 1, step: 0.01 },
      maxTokensRange: { min: 1, max: 65536, step: 1 },
      topKRange: { min: 1, max: 100, step: 1 },
      capabilities: { search: true, url: false, code: false, functions: false, structured: false, aspectRatio: true, resolution: true, topK: true, stopSequences: true },
      defaults: { temp: '0.70', topP: '0.95', topK: '40', maxTokens: '65536', search: false, url: false, code: false, structured: false, structuredSchema: "", functions: false, functionsSchema: "", instructions: "", stopSequences: "", safetySettings: { harassment: "OFF", hate: "OFF", sexuallyExplicit: "OFF", dangerousContent: "OFF" }, aspectRatio: '1:1', resolution: 'Default' }
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports = BAS_CONFIG;
}
