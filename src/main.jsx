import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { initSentry } from './lib/sentry.js'
import { THEME } from './theme.js'

initSentry()

const style = document.createElement('style')
style.textContent = `
  :root {
    --bg-page: #F0F2F5;
    --bg-card: #ffffff;
    --bg-secondary: #F5F7FA;
    --surface-muted: #F3F4F6;
    --text-primary: #111318;
    --text-secondary: #6B7280;
    --text-muted: #9CA3AF;
    --border: #E2E6ED;
    --nav-bg: #111318;
    --primary: #1E4D8C;
    --primary-dark: #0F2347;
    --primary-light: #3B6FC4;
    --primary-bg: #E8EFFA;
    --success: #2F8F3E;
    --success-bg: #E9F6EA;
    --warning: #D08A1E;
    --warning-bg: #FCF1E0;
    --danger: #C13B3B;
    --danger-bg: #FBECEC;
    --gradient: linear-gradient(135deg, #0F2347 0%, #1E4D8C 50%, #3B6FC4 100%);
  }
  [data-theme="dark"] {
    --bg-page: #0F1117;
    --bg-card: #1A1D27;
    --bg-secondary: #232634;
    --surface-muted: #232634;
    --text-primary: #F0F2F5;
    --text-secondary: #9CA3AF;
    --text-muted: #6B7280;
    --border: #2D3148;
    --nav-bg: #0A0C14;
    --primary: #4A7FD1;
    --primary-dark: #1E4D8C;
    --primary-light: #6B9AE0;
    --primary-bg: #1C2942;
    --success: #4CAF58;
    --success-bg: #16291A;
    --warning: #E0A23D;
    --warning-bg: #2E2410;
    --danger: #E05A5A;
    --danger-bg: #2E1616;
    --gradient: linear-gradient(135deg, #0A1730 0%, #1E4D8C 50%, #2E5CA8 100%);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg-page);
    color: var(--text-primary);
    transition: background .3s, color .3s;
  }
  input, select, textarea, button { font-family: inherit; }
  ::-webkit-scrollbar { display: none; }
  ::selection { background: ${THEME.primary}; color: white; }
`
document.head.appendChild(style)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
