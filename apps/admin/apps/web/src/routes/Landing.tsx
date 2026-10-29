import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { navigate } from '../lib/router';
import { useI18n } from '../lib/i18n';
import { Icon } from '../components/icons';
import type { IconName } from '../components/icons';
import { FeatherMark } from '../components/FeatherMark';
import { BrandLabel } from '../components/BrandLabel';
import { Button } from '../components/Button';
import { LocaleSwitch } from '../components/LocaleSwitch';
import { ThemeToggle } from '../components/ThemeToggle';
import { Footer } from '../components/Footer';

/**
 * The public front door.
 *
 * It exists because the prerendered HTML has to say the same thing the mounted app
 * says: a crawler that reads one page and a visitor who sees another is cloaking, and
 * a landing page that only exists in the build output is a lie with extra steps. So
 * this screen renders the same copy the prerenderer writes, in both languages, and
 * `/` shows it to anyone who is not signed in.
 */
export function Landing({ version }: { version: string | null }): ReactElement {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /**
   * The drawer is a full-screen layer, so it has to behave like a dialog or it is
   * just a page that happens to cover another page: Escape closes it, Tab stays
   * inside it, and the document behind it does not scroll underneath the finger.
   */
  useEffect(() => {
    if (!menuOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    const focusable = () =>
      Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !drawer.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !drawer.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    // Rotating a tablet past the breakpoint hides the drawer in CSS; without this
    // the body would stay locked behind a layer nobody can see.
    const wide = window.matchMedia('(min-width: 1025px)');
    const onWide = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };
    wide.addEventListener('change', onWide);

    focusable()[0]?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      wide.removeEventListener('change', onWide);
      if (drawer.contains(document.activeElement)) toggleRef.current?.focus();
    };
  }, [menuOpen]);

  const features = [
    { title: t('landing.feature1.title'), body: t('landing.feature1.body') },
    { title: t('landing.feature2.title'), body: t('landing.feature2.body') },
  ];

  const steps = [t('landing.step1'), t('landing.step2'), t('landing.step3')];

  const featureIconNames: IconName[] = ['user', 'check'];

  return (
    <div className="landing">
      <a className="skip-link" href="#main">
        {t('a11y.skipToContent')}
      </a>
      <nav
        className={`landing__nav${scrolled ? ' landing__nav--scrolled' : ''}`}
        aria-label="Main navigation"
      >
        <span className="landing__nav-brand">
          <BrandLabel version={version} />
        </span>
        <button
          ref={toggleRef}
          type="button"
          className="landing__nav-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="landing-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
        <div
          id="landing-menu"
          ref={drawerRef}
          className={`landing__nav-center${menuOpen ? ' landing__nav-center--open' : ''}`}
          role={menuOpen ? 'dialog' : undefined}
          aria-modal={menuOpen ? 'true' : undefined}
          aria-label={menuOpen ? 'Menu' : undefined}
        >
          <div className="landing__nav-links">
            <a
              href="/about"
              onClick={(e) => {
                e.preventDefault();
                navigate('/about');
                setMenuOpen(false);
              }}
            >
              {t('footer.about')}
            </a>
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                navigate('/privacy');
                setMenuOpen(false);
              }}
            >
              {t('footer.privacy')}
            </a>
            <a
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                navigate('/terms');
                setMenuOpen(false);
              }}
            >
              {t('footer.terms')}
            </a>
          </div>
          <div className="landing__nav-mobile-extra">
            <div className="landing__nav-mobile-row">
              <LocaleSwitch />
              <ThemeToggle />
            </div>
            <a
              href="/signin"
              className="landing__nav-signin landing__nav-signin--mobile"
              onClick={(e) => {
                e.preventDefault();
                navigate('/signin');
                setMenuOpen(false);
              }}
            >
              <Icon name="key" />
              {t('auth.signIn.submit')}
            </a>
            <Button
              small
              className="landing__nav-cta landing__nav-cta--drawer"
              icon={<Icon name="plus" />}
              onClick={() => {
                navigate('/signup');
                setMenuOpen(false);
              }}
            >
              {t('landing.cta')}
            </Button>
          </div>
        </div>
        <div className="landing__nav-right">
          <LocaleSwitch className="landing__lang" />
          <div className="landing__nav-right-extra">
            <ThemeToggle className="landing__theme" />
            <a
              href="/signin"
              className="landing__nav-signin"
              onClick={(e) => {
                e.preventDefault();
                navigate('/signin');
              }}
            >
              <Icon name="key" />
              {t('auth.signIn.submit')}
            </a>
            <Button
              small
              className="landing__nav-cta"
              icon={<Icon name="plus" />}
              onClick={() => navigate('/signup')}
            >
              {t('landing.cta')}
            </Button>
          </div>
        </div>
      </nav>
      <header className="landing__hero">
        <div className="landing__copy">
          <p className="landing__brand">{t('app.brand')}</p>
          <h1 className="display-xl">{t('landing.title')}</h1>
          <p className="body muted">{t('landing.lede')}</p>
          <div className="cluster">
            <Button icon={<Icon name="plus" />} onClick={() => navigate('/signup')}>
              {t('landing.cta')}
            </Button>
            <Button
              variant="tertiary"
              icon={<Icon name="key" />}
              onClick={() => navigate('/signin')}
            >
              {t('landing.secondary')}
            </Button>
          </div>
          <p className="fine-print">{t('landing.note')}</p>
        </div>
        <div className="landing__shot" aria-hidden="true">
          <FeatherMark className="landing__shot-brand" />
          <span className="landing__shot-title" />
          <div className="landing__shot-seg">
            <span className="landing__shot-segb landing__shot-segb--on" />
            <span className="landing__shot-segb" />
            <span className="landing__shot-segb" />
          </div>
          <div className="landing__shot-paper">
            <span className="landing__shot-line landing__shot-line--head" />
            <span className="landing__shot-line" />
            <span className="landing__shot-line" />
            <span className="landing__shot-line landing__shot-line--short" />
            <span className="landing__shot-line landing__shot-line--gap" />
            <span className="landing__shot-line" />
            <span className="landing__shot-line landing__shot-line--short" />
          </div>
          <div className="landing__shot-chips">
            <span className="landing__shot-chip" />
            <span className="landing__shot-chip landing__shot-chip--alt" />
          </div>
        </div>
      </header>

      <main id="main">
        <section className="landing__features" aria-label={t('landing.feature1.title')}>
          {features.map((feature, index) => (
            <article key={feature.title} className="landing__feature">
              <span className="landing__feature-icon" aria-hidden="true">
                <Icon name={featureIconNames[index]} size={24} />
              </span>
              <h2 className="display-sm">{feature.title}</h2>
              <p className="body muted">{feature.body}</p>
            </article>
          ))}
        </section>

        <section className="landing__steps">
          <h2>{t('landing.steps.title')}</h2>
          <ol>
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="fine-print">{t('landing.langNote')}</p>
        </section>

        <section className="landing__cta">
          <h2 className="display-section">{t('landing.banner.title')}</h2>
          <p className="body muted">{t('landing.note')}</p>
          <Button icon={<Icon name="plus" />} onClick={() => navigate('/signup')}>
            {t('landing.cta')}
          </Button>
        </section>
      </main>
      <Footer />
    </div>
  );
}
