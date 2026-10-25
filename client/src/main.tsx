import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Layout from './Layout.tsx'

// Client entry point: load global styles, then wrap the main app in shared layout and theme state.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Layout>
      <App />
    </Layout>
  </StrictMode>,
)
