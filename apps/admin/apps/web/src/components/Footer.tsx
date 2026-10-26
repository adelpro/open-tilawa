import type { ReactElement } from 'react';
import { navigate } from '../lib/router';
import { useI18n } from '../lib/i18n';
import { APP_VERSION } from '../lib/version';
import { FeatherMark } from './FeatherMark';

export function Footer(): ReactElement {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div className="site-footer__brandblock">
          <FeatherMark className="site-footer__mark" label="Tilawa Admin" />
          <h3>{t('app.brand')}</h3>
          <p className="site-footer__tagline">{t('app.tagline')}</p>
        </div>
        <div className="site-footer__col">
          <h3>{t('footer.product')}</h3>
          <a
            href="/signup"
            onClick={(e) => {
              e.preventDefault();
              navigate('/signup');
            }}
          >
            {t('landing.cta')}
          </a>
          <a
            href="/signin"
            onClick={(e) => {
              e.preventDefault();
              navigate('/signin');
            }}
          >
            {t('landing.secondary')}
          </a>
        </div>
        <div className="site-footer__col">
          <h3>{t('footer.links')}</h3>
          <a
            href="/about"
            onClick={(e) => {
              e.preventDefault();
              navigate('/about');
            }}
          >
            {t('footer.about')}
          </a>
          <a
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              navigate('/privacy');
            }}
          >
            {t('footer.privacy')}
          </a>
          <a
            href="/terms"
            onClick={(e) => {
              e.preventDefault();
              navigate('/terms');
            }}
          >
            {t('footer.terms')}
          </a>
        </div>
        <div className="site-footer__col">
          <h3>{t('footer.contact')}</h3>
          <a href="mailto:contact@adelpro.us.kg">contact@adelpro.us.kg</a>
        </div>
      </div>
      <div className="site-footer__inner">
        <p className="site-footer__copy">
          {t('footer.copy')} · v{APP_VERSION}
        </p>
      </div>
    </footer>
  );
}
