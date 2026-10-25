import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useNavigate } from 'react-router-dom';

import { APP_VERSION } from '@/constants/version';

type Lang = 'ar' | 'en';
type Theme = 'light' | 'dark' | 'system';

const NAV_LINKS = [
  { href: '/', label: 'الصفحة الرئيسية' },
  { href: '/about', label: 'معلومات عن التطبيق' },
  { href: '/privacy', label: 'سياسة الخصوصية' },
  { href: '/contact', label: 'إتصل بنا' },
];

export default function Header() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('ar');
  const [theme, setTheme] = useState<Theme>('system');

  const langRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setLangOpen(false); setThemeOpen(false); setMenuOpen(false); }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const applyTheme = (t: Theme) => {
    setTheme(t);
    const root = document.documentElement;
    if (t === 'light') root.setAttribute('data-theme', 'light');
    else if (t === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  };

  const themeIcon = theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-canvas shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2"
          onClick={() => setMenuOpen(false)}
        >
          <Image
            src="/images/icon.png"
            alt="تلاوة"
            width={64}
            height={30}
            className="h-[30px] w-auto shrink-0"
          />
          <span className="text-xs text-ink-secondary">v{APP_VERSION}</span>
        </Link>

        {/* Desktop nav links — center */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-secondary transition-colors duration-150 hover:bg-canvas-parchment hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right cluster: language + theme (desktop) */}
        <div className="hidden items-center gap-2 md:flex">
          {/* Language dropdown */}
          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              aria-label="Language"
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-ink-secondary transition-colors duration-150 hover:bg-canvas-parchment hover:text-ink"
            >
              <span aria-hidden="true">🌐</span>
              <span className="hidden font-medium lg:inline">{lang.toUpperCase()}</span>
            </button>
            {langOpen && (
              <div className="absolute inset-inline-end-0 top-full mt-1 min-w-[120px] rounded-lg border border-hairline bg-canvas shadow-premium">
                {(['ar', 'en'] as Lang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => { setLang(l); setLangOpen(false); }}
                    className={`block w-full px-3 py-2 text-start text-sm transition-colors duration-150 hover:bg-canvas-parchment ${
                      lang === l ? 'font-semibold text-primary' : 'text-ink'
                    }`}
                  >
                    {l === 'ar' ? 'العربية' : 'English'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme dropdown */}
          <div className="relative" ref={themeRef}>
            <button
              type="button"
              onClick={() => setThemeOpen((v) => !v)}
              aria-label="Theme"
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-ink-secondary transition-colors duration-150 hover:bg-canvas-parchment hover:text-ink"
            >
              <span aria-hidden="true">{themeIcon}</span>
            </button>
            {themeOpen && (
              <div className="absolute inset-inline-end-0 top-full mt-1 min-w-[120px] rounded-lg border border-hairline bg-canvas shadow-premium">
                {(['light', 'dark', 'system'] as Theme[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { applyTheme(t); setThemeOpen(false); }}
                    className={`block w-full px-3 py-2 text-start text-sm transition-colors duration-150 hover:bg-canvas-parchment ${
                      theme === t ? 'font-semibold text-primary' : 'text-ink'
                    }`}
                  >
                    {t === 'light' ? '☀ فاتح' : t === 'dark' ? '☾ داكن' : '◐ نظام'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu toggle — animated sandwich that morphs into a close (X) */}
        <button
          type="button"
          className="relative h-8 w-8 rounded-md p-1.5 transition-colors duration-150 hover:bg-canvas-parchment md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span
            aria-hidden="true"
            className={`absolute left-1.5 right-1.5 h-[2px] rounded bg-ink transition-all duration-300 ${
              menuOpen ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-[6.5px]'
            }`}
          />
          <span
            aria-hidden="true"
            className={`absolute left-1.5 right-1.5 top-1/2 h-[2px] -translate-y-1/2 rounded bg-ink transition-all duration-300 ${
              menuOpen ? 'opacity-0 scale-x-0' : 'opacity-100'
            }`}
          />
          <span
            aria-hidden="true"
            className={`absolute left-1.5 right-1.5 h-[2px] rounded bg-ink transition-all duration-300 ${
              menuOpen ? 'top-1/2 -translate-y-1/2 -rotate-45' : 'bottom-[6.5px]'
            }`}
          />
        </button>
      </div>

      {/* Mobile dropdown — all items */}
      {menuOpen && (
        <div className="border-t border-hairline bg-canvas md:hidden">
          <div className="flex flex-col px-4 py-3">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-canvas-parchment"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2 border-t border-hairline pt-3">
              <button
                type="button"
                onClick={() => { setLang(lang === 'ar' ? 'en' : 'ar'); }}
                className="flex-1 rounded-md px-3 py-2 text-sm text-ink-secondary transition-colors duration-150 hover:bg-canvas-parchment"
              >
                🌐 {lang.toUpperCase()}
              </button>
              <button
                type="button"
                onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex-1 rounded-md px-3 py-2 text-sm text-ink-secondary transition-colors duration-150 hover:bg-canvas-parchment"
              >
                {themeIcon} {theme === 'dark' ? 'فاتح' : 'داكن'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}