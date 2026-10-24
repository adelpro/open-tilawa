import { Routes, Route, useParams } from 'react-router-dom';
import Home from './app/page';
import AboutPage from './app/about/about-page';
import ContactPage from './app/contact/contact-page';
import PrivacyPage from './app/privacy/privacy-page-ar';
import ReciterPage from './app/reciter/[id]/reciter-page';
import NotFound from './app/not-found';

import ActivityStatus from './components/activity-status';
import Footer from './components/footer';

function ReciterRoute() {
  const { id } = useParams();
  const numId = id ? Number(id) : undefined;
  return <ReciterPage id={numId} />;
}

export default function App() {
  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center justify-center bg-background text-foreground">
      <ActivityStatus />
      <div className="w-full flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/reciter/:id" element={<ReciterRoute />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <Footer />
    </main>
  );
}
