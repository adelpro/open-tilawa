import { Route, Routes } from 'react-router-dom';

import AboutPage from './app/about/about-page';
import ContactPage from './app/contact/contact-page';
import LibraryPage from './app/page';
import NotFound from './app/not-found';
import PrivacyPage from './app/privacy/privacy-page-ar';
import ReciterPage from './app/reciter/[id]/reciter-page';
import AudioEngine from './components/audio-engine';
import ErrorBoundary from './components/error-boundary';
import MiniPlayer from './components/mini-player';
import { BottomTabs, SideNav } from './components/nav';
import Queue from './components/queue';

/**
 * The shell: three columns on a desk, one scroll on a phone.
 *
 * `<AudioEngine>` sits outside `<Routes>` on purpose — it is the only audio
 * element in the app, so a surah keeps playing while you browse.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <div className="flex min-h-dvh flex-col lg:grid lg:h-dvh lg:grid-cols-[264px_minmax(0,1fr)_340px] lg:overflow-hidden">
        <SideNav />

        <main className="min-w-0 lg:h-dvh lg:overflow-y-auto">
          <Routes>
            <Route path="/" element={<LibraryPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/reciter/:id" element={<ReciterPage />} />
            <Route path="/reciter/:id/:surah" element={<ReciterPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          {/* Room for the mini-player and the tab bar. */}
          <div aria-hidden="true" className="h-[calc(7rem+env(safe-area-inset-bottom))] lg:hidden" />
        </main>

        <aside className="hidden min-h-0 border-s border-divider lg:flex lg:h-dvh">
          <Queue className="w-full" />
        </aside>
      </div>

      <BottomTabs />
      <MiniPlayer />
      <AudioEngine />
    </ErrorBoundary>
  );
}
