import React from 'react'
import ReactDOM from 'react-dom/client'
import { ToastProvider } from './utils/ToastContext'
import { AuthProvider } from './utils/AuthContext'
import { AppProvider } from './utils/AppContext'
import App from './App'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/serviceWorker.js')
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
)
