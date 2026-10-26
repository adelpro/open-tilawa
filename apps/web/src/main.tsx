import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './app/globals.css';
import { applyTheme, resolveInitialTheme } from './hooks/use-theme';

// Before the first paint, so a dark-mode listener never sees a white flash.
applyTheme(resolveInitialTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
