import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './app/globals.css';
import { registerAppWorker } from './utils/sw-registration';

// Install the shell (and the streaming origin) immediately, not on first play.
void registerAppWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
