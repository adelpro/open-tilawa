import type { ReactElement, ReactNode } from 'react';
import { Footer } from './Footer';

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

export function LegalPage({
  title,
  version,
  lede,
  sections,
}: {
  title: string;
  /** Privacy and terms carry a version; an about page does not. */
  version?: string;
  /** The opening paragraph, before the numbered sections. */
  lede?: ReactNode;
  sections: LegalSection[];
}): ReactElement {
  return (
    <div className="legal">
      <main className="legal__article">
        <h1 className="display-lg">{title}</h1>
        {version ? <p className="legal__version">{version}</p> : null}
        {lede ? <p className="legal__lede">{lede}</p> : null}
        {sections.map((s, i) => (
          <section key={i} className="legal__section">
            <h2 className="display-sm">{s.heading}</h2>
            <div className="body">{s.body}</div>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
