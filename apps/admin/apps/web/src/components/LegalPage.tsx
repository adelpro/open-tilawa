import type { ReactElement, ReactNode } from 'react';
import { Footer } from './Footer';

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

export function LegalPage({
  title,
  version,
  sections,
}: {
  title: string;
  version: string;
  sections: LegalSection[];
}): ReactElement {
  return (
    <div className="legal">
      <article className="legal__article">
        <h1 className="display-lg">{title}</h1>
        <p className="legal__version">{version}</p>
        {sections.map((s, i) => (
          <section key={i} className="legal__section">
            <h2 className="display-sm">{s.heading}</h2>
            <div className="body">{s.body}</div>
          </section>
        ))}
      </article>
      <Footer />
    </div>
  );
}
