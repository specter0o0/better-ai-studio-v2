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
  presets: {
    default: {
      name: 'Default',
      instructions: '',
      tools: {
        search: false,
        urlContext: false,
        code: false,
        structuredOutput: false,
        functionCalling: false
      },
      settings: {
        temperature: 1.0,
        topP: 0.95
      }
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports = BAS_CONFIG;
}
