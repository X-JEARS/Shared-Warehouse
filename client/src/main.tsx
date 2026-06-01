import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/theme.css';
import './styles/global.css';
import { useThemeStore } from './stores/themeStore';

// Initialize theme before rendering to prevent flash
useThemeStore.getState()._init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
