import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './app/globals.css';
import { registerAppWorker } from './utils/sw-registration';
import { alignUrlWithLocale, applyLocale, resolveInitialLocale } from './hooks/use-locale';
import { applyTheme, resolveInitialTheme } from './hooks/use-theme';
import { migrateStorageNamespace } from './utils/storage-keys';

// The namespace moved from `open-tilawa` to `tilawah`. Copy the old keys before
// anything reads them: the locale and theme below are the first readers, and
// after them the account bridge. A blocked store is not an error here.
try {
  if (typeof window !== 'undefined') migrateStorageNamespace(window.localStorage);
} catch {
  // private mode: the app works, it just starts from defaults
}

// Before the first paint, so neither direction nor palette can flash. The address is
// moved in the same breath: a page painted in English must not keep an Arabic URL.
const startLocale = resolveInitialLocale();
applyLocale(startLocale);
alignUrlWithLocale(startLocale);
applyTheme(resolveInitialTheme());

// Install the shell (and the streaming origin) immediately, not on first play.
void registerAppWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
