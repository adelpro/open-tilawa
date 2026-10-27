import { useState } from 'react';

import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/utils/cn';

export default function AuthForm({
  mode,
  loading,
  error,
  onSubmit,
}: {
  mode: 'login' | 'create';
  loading: boolean;
  error: string | null;
  onSubmit: (alias: string, password: string) => void;
}) {
  const { t } = useLocale();
  const copy = t.account;
  const [alias, setAlias] = useState('');
  const [password, setPassword] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alias.trim() || password.length < 6) return;
    onSubmit(alias.trim(), password);
  };

  const field =
    'w-full rounded-xl border border-line bg-transparent px-3 py-2.5 text-[14px] text-ink outline-none focus:border-ink';

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <input
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
        placeholder={copy.username}
        aria-label={copy.username}
        autoComplete="username"
        className={field}
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder={`${copy.password} (${copy.passwordHint})`}
        aria-label={copy.password}
        autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
        className={field}
      />
      <button
        type="submit"
        disabled={loading || !alias.trim() || password.length < 6}
        className="w-full rounded-xl bg-ink px-3 py-2.5 text-[14px] font-medium text-surface disabled:opacity-40"
      >
        {loading ? '…' : mode === 'create' ? copy.createAction : copy.signInAction}
      </button>
      {error ? <p className="text-[12px] text-red-500">{error}</p> : null}
      {mode === 'create' ? (
        <p className="text-[11.5px] leading-relaxed text-muted">{copy.createNote}</p>
      ) : null}
    </form>
  );
}
