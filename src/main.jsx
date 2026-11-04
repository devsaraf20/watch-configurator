import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary
      name="App"
      fallback={(error) => (
        <div className="viewer-error" role="alert">
          <h2>Something went wrong</h2>
          <p>Please reload the page.</p>
          <code>{String(error?.message ?? error)}</code>
        </div>
      )}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
