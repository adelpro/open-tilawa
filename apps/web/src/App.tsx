import PlayerPage from './app/player-page';
import AudioEngine from './components/audio-engine';
import ErrorBoundary from './components/error-boundary';

/**
 * One screen and the one <audio> element that outlives it.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <PlayerPage />
      <AudioEngine />
    </ErrorBoundary>
  );
}
