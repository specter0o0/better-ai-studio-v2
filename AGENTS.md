# Better AI Studio - Agent Guidance

## Core Philosophy
Minimalism. Precision. Performance. This extension is a performance-tuned overlay for AI Studio. Maintain the industrial, zero-delay aesthetic.

## Tech Stack
- **Manifest V3**: No build step. No npm. No transpilation.
- **Languages**: Vanilla JavaScript (ES6+), CSS3, HTML5.
- **Storage**: `chrome.storage.local` for persistence, `BroadcastChannel` for instance sync.

## Project Structure
- `config.js`: Single source of truth for defaults and model capabilities.
- `scripts/content.js`: Non-blocking DOM manipulation and settings application.
- `popup/`: UI logic and state management. Use `applyAllUI()` for state updates.
- `styles/theme.css`: Centralized industrial design tokens.

## Development Standards
- **Indentation**: 4 spaces everywhere.
- **Syntax**: Keep semicolons. Prefer `const`/`let`. Arrow functions for callbacks.
- **DOM**: Cache lookups. Use early returns/guard clauses.
- **CSS**: Strict 8px spacing rhythm. Use CSS variables. Avoid `!important`.
- **Sync**: Maintain the "absolute sync" logic across popups and tabs.

## Verification
- Testing popup URL: `chrome-extension://opfknoobfcpeenednnajilghegjdfnfo/popup/popup.html`.
- Test real-time sync on `https://aistudio.google.com/*`.

## Critical Constraints
- Do not add external dependencies or build tools.
- Never modify storage keys without backward compatibility.
- Ensure selectors are resilient to AI Studio DOM updates.
- Keep `scripts/content.js` light to avoid page latency.
