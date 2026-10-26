import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactElement } from 'react';
import { SessionProvider, useSession } from './lib/session';
import { LocaleProvider, useI18n } from './lib/i18n';
import { ThemeProvider } from './lib/theme.tsx';
import { navigate, useRouter } from './lib/router';
import { navItemsFor, consolePathFor } from './lib/nav';
import type { AppRole } from './lib/nav';
import { api } from './lib/api';
import { BrandLabel } from './components/BrandLabel';
import { SignIn } from './routes/SignIn';
import { Landing } from './routes/Landing';
import { SignUp } from './routes/SignUp';
import { Activate } from './routes/Activate';
import { TwoFactor } from './routes/TwoFactor';
import { ResetPassword } from './routes/ResetPassword';
import { Setup } from './routes/Setup';
import { About } from './routes/About';
import { Help } from './routes/Help';
import { Privacy } from './routes/Privacy';
import { Terms } from './routes/Terms';
import { Account } from './routes/Account';
import { AdminConsole } from './routes/AdminConsole';
import { Seeders } from './routes/Seeders';
import { Turns } from './routes/Turns';
import { TurnDetail } from './routes/TurnDetail';
import { Torrents } from './routes/Torrents';
import { Reciters } from './routes/Reciters';
import { Avatar } from './components/Avatar';
import { SkeletonHeading, SkeletonRows } from './components/Skeleton';
import { Icon } from './components/icons';
import { LocaleSwitch } from './components/LocaleSwitch';

/**
 * The app: a small router, a session, and a shell.
 *
 * Screen choice is a switch on the first segment rather than a table, because
 * there are a dozen screens and a table would only hide which one is missing.
 * The guard here is for the user's benefit — a signed-out visitor seeing the
 * sign-in form instead of an empty table — never the security boundary: the API
 * answers 401 to every route that needs a session, whatever the client believes.
 */
export function App(): ReactElement {
  return (
    <SessionProvider>
      <ThemeProvider>
        <LocaleProvider>
          <Screens />
        </LocaleProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

function Screens(): ReactElement {
  const { path, segments } = useRouter();
  const { user, loading, signOut } = useSession();
  const { t } = useI18n();
  const [first, second] = segments;
  const [menuOpen, setMenuOpen] = useState(false);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeMenu = (): void => setMenuOpen(false);

  useEffect(() => {
    let cancelled = false;
    // The released version, for the header label. `/health` is public on
    // purpose; a failed call just leaves the label without a version.
    api<{ version?: string }>('/health')
      .then((health) => {
        if (!cancelled && health.version) setVersion(health.version);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<{ required: boolean }>('/setup/status')
      .then((r) => {
        if (!cancelled) setSetupRequired(r.required);
      })
      .catch(() => {
        if (!cancelled) setSetupRequired(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (setupRequired && first !== 'setup' && first !== 'activate' && first !== 'reset-password') {
      navigate('/setup', { replace: true });
    }
  }, [setupRequired, first]);

  // The drawer is a route-level surface: it never stays open across a navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  // A super admin and an admin each have one console. A stale URL for the other one
  // is sent to the correct screen rather than rendering the wrong verb set.
  useEffect(() => {
    if (!user) return;
    const target = consolePathFor(user.role);
    if (!target) return;
    if (first === 'admin' && target !== '/dashboard/admin') {
      navigate(target, { replace: true });
    } else if (first === 'superadmin' && target !== '/dashboard/superadmin') {
      navigate(target, { replace: true });
    }
  }, [first, user]);

  // The drawer's keyboard contract: Escape closes it, Tab cycles inside the panel,
  // the page behind it cannot scroll, and focus returns to the menu button.
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = panel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!controls || controls.length === 0) return;
      const firstControl = controls[0];
      const lastControl = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === firstControl || document.activeElement === panel.current)
      ) {
        event.preventDefault();
        lastControl.focus();
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault();
        firstControl.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      if (
        document.activeElement === document.body ||
        panel.current?.contains(document.activeElement)
      ) {
        menuButton.current?.focus();
      }
    };
  }, [menuOpen]);

  // A drawer is a small-screen affordance. Growing past the breakpoint dismisses it
  // instead of leaving an invisible focus trap behind.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1025px)');
    const onChange = (): void => {
      if (query.matches) setMenuOpen(false);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // The mail templates link to `/activate/<token>` and `/reset-password/<token>`,
  // so those two are matched by path, with `?token=` accepted as well.
  if (first === 'signup') return <SignUp />;
  if (first === 'activate') return <Activate token={second ?? null} />;
  if (first === 'reset-password') return <ResetPassword token={second ?? null} />;
  if (first === 'setup') return <Setup />;
  if (first === 'about') return <About />;
  if (first === 'privacy') return <Privacy />;
  if (first === 'terms') return <Terms />;
  if (first === '2fa') return <TwoFactor />;
  if (first === 'signin') return <SignIn />;

  // The session has not resolved yet. This used to be the word "Loading…" on an empty
  // cream page — no brand, no nav, no frame — and then the whole interface appeared at
  // once. The shell is static copy, so it can be rendered before we know who is asking:
  // only the parts that need the account are placeholders. The frame never disappears.
  if (loading) return <ShellSkeleton version={null} />;

  // Signed out: the root is the public page, everywhere else is the sign-in form. The
  // landing screen is what the prerendered HTML also contains, so a crawler and a
  // visitor are looking at the same thing.
  if (!user) {
    if (!first) return <Landing version={version} />;
    if (first === 'about') return <About />;
    if (first === 'help') return <Help />;
    if (first === 'privacy') return <Privacy />;
    if (first === 'terms') return <Terms />;
    return <SignIn />;
  }

  return (
    <div className="shell">
      {/*
        The first tab stop on every signed-in screen. It is off-screen until it has focus,
        because a visible "skip to content" on a page with a nine-item nav is more clutter
        than the problem it solves — and it is the only way a keyboard user avoids tabbing
        through the sidebar on every navigation.
      */}
      <a className="skip-link" href="#main">
        {t('a11y.skipToContent')}
      </a>

      <aside className="shell__aside">
        <div className="shell__bar">
          <a
            className="shell__brand"
            href="/dashboard"
            onClick={(event) => {
              go('/dashboard')(event);
            }}
          >
            <BrandLabel version={version} />
          </a>
        </div>
        <div className="shell__nav-wrap">
          <AppNav role={user.role} />
          <AccountBlock user={user} onSignOut={() => void signOut()} />
        </div>
      </aside>

      <header className="shell__topbar">
        <a
          className="shell__brand"
          href="/dashboard"
          onClick={(event) => {
            go('/dashboard')(event);
          }}
        >
          <BrandLabel version={version} />
        </a>
        <button
          ref={menuButton}
          type="button"
          className="shell__menu"
          aria-label={t('nav.menu')}
          aria-expanded={menuOpen}
          aria-controls="shell-drawer"
          onClick={() => setMenuOpen(true)}
        >
          <Icon name="menu" size={20} />
        </button>
      </header>

      <div
        className={`shell__drawer${menuOpen ? ' shell__drawer--open' : ''}`}
        aria-hidden={!menuOpen}
      >
        <div className="shell__scrim" onClick={closeMenu} aria-hidden="true" />
        <div
          ref={panel}
          id="shell-drawer"
          className="shell__panel"
          role="dialog"
          aria-modal="true"
          aria-label={t('a11y.primaryNav')}
          inert={!menuOpen}
        >
          <div className="shell__drawer-head">
            <span className="shell__brand">
              <BrandLabel version={version} />
            </span>
            <button
              ref={closeButton}
              type="button"
              className="shell__close"
              aria-label={t('nav.closeMenu')}
              onClick={closeMenu}
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          <div className="shell__drawer-body">
            <AppNav role={user.role} onNavigate={closeMenu} />
          </div>
          <AccountBlock user={user} onSignOut={() => void signOut()} />
        </div>
      </div>

      <main id="main" className="shell__main" tabIndex={-1}>
        <Screen first={first} second={second} role={user.role} />
      </main>
    </div>
  );
}

function Screen({
  first,
  second,
  role,
}: {
  first: string | undefined;
  second: string | undefined;
  role: AppRole;
}): ReactElement {
  if (first === 'seeders') return <Seeders />;
  if (first === 'turns') {
    return second ? <TurnDetail id={Number(second)} /> : <Turns />;
  }
  if (first === 'torrents') return <Torrents seederId={second} />;
  if (first === 'reciters') return <Reciters />;
  if (first === 'account') return <Account />;
  if (first === 'help') return <Help />;
  const consolePath = consolePathFor(role);
  if (first === 'admin' && consolePath === '/dashboard/admin') {
    return <AdminConsole isSuper={false} />;
  }
  if (first === 'superadmin' && consolePath === '/dashboard/superadmin') {
    return <AdminConsole isSuper />;
  }
  return <Seeders />;
}

/** The navigation, shared by the desktop column and the drawer so the wording cannot drift. */
function AppNav({
  role,
  onNavigate,
}: {
  role: AppRole | null;
  onNavigate?: () => void;
}): ReactElement {
  const { t } = useI18n();
  const items = navItemsFor(role);
  const groups = [
    { id: 'workspace' as const, label: t('nav.workspace') },
    ...(items.some((item) => item.group === 'admin')
      ? [{ id: 'admin' as const, label: t('nav.management') }]
      : []),
  ];

  return (
    <nav className="nav" aria-label={t('a11y.primaryNav')}>
      {groups.map((group) => (
        <div className="nav__group" key={group.id}>
          <span className="nav__label">{group.label}</span>
          {items
            .filter((item) => item.group === group.id)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                label={t(item.labelKey)}
                icon={item.icon}
                onNavigate={onNavigate}
              />
            ))}
        </div>
      ))}
    </nav>
  );
}

function AccountBlock({
  user,
  onSignOut,
}: {
  user: { id: number; name: string; email: string; avatarUpdatedAt?: string | null };
  onSignOut: () => void;
}): ReactElement {
  const { t } = useI18n();
  return (
    <div className="shell__account">
      <div className="shell__identity">
        <Avatar
          userId={user.id}
          name={user.name}
          email={user.email}
          avatarUpdatedAt={user.avatarUpdatedAt}
          size={34}
        />
        <span className="shell__identity-text">
          <span className="caption-strong truncate">{user.name}</span>
          <span className="fine-print truncate">{user.email}</span>
        </span>
      </div>
      <LocaleSwitch />
      <button type="button" className="shell__signout" onClick={onSignOut}>
        <Icon name="logout" size={16} />
        <span>{t('nav.signOut')}</span>
      </button>
    </div>
  );
}

/**
 * The shell, before the session answers.
 *
 * The nav labels are catalogue copy rather than account data, so they are real here; the
 * avatar block is not, so it is a placeholder of the same height. Nothing on this screen
 * moves when the real interface replaces it, which is the point: a loading state that
 * changes the layout is worse than the wait it covers.
 */
function ShellSkeleton({ version }: { version: string | null }): ReactElement {
  const { t } = useI18n();
  return (
    <div className="shell">
      <aside className="shell__aside">
        <div className="shell__bar">
          <span className="shell__brand">
            <BrandLabel version={version} />
          </span>
        </div>
        <div className="shell__nav-wrap">
          <nav className="nav" aria-hidden="true">
            <div className="nav__group">
              <span className="nav__label">{t('nav.workspace')}</span>
              <span className="nav__link">{t('nav.seeders')}</span>
              <span className="nav__link">{t('nav.turns')}</span>
              <span className="nav__link">{t('nav.torrents')}</span>
              <span className="nav__link">{t('nav.account')}</span>
            </div>
          </nav>
          <div className="skeleton shell__account-placeholder" aria-hidden="true">
            <span className="skeleton__bar skeleton__bar--md" />
            <span className="skeleton__bar skeleton__bar--sm" />
            <span className="skeleton__bar skeleton__bar--md" />
          </div>
        </div>
      </aside>
      <header className="shell__topbar">
        <span className="shell__brand">
          <BrandLabel version={version} />
        </span>
      </header>
      <main className="shell__main" aria-busy="true">
        <div className="screen">
          <SkeletonHeading />
          <SkeletonRows rows={4} label={t('app.loading')} />
        </div>
      </main>
    </div>
  );
}

function NavLink({
  to,
  label,
  icon,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  onNavigate?: () => void;
}): ReactElement {
  const { path } = useRouter();
  const active =
    to === '/dashboard'
      ? path === '/dashboard' || path.startsWith('/dashboard/profiles')
      : path === to || path.startsWith(`${to}/`);
  return (
    <a
      className={`nav__link${active ? ' nav__link--active' : ''}`}
      href={to}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        go(to)(event);
        onNavigate?.();
      }}
    >
      <Icon name={icon} size={18} className="nav__icon" />
      <span>{label}</span>
    </a>
  );
}

/** A nav link that changes the URL without a page load. */
function go(to: string): (event: ReactMouseEvent<HTMLAnchorElement>) => void {
  return (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(to);
  };
}
