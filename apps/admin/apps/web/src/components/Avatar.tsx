import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { gravatarUrl } from '../lib/gravatar';

interface AvatarProps {
  userId: number;
  name: string;
  email?: string;
  /** From `GET /me`; when set the account has an uploaded photo. */
  avatarUpdatedAt?: string | null;
  size?: number;
}

/**
 * The account's face, in the one order that makes sense:
 * uploaded photo → Gravatar → initials.
 *
 * Each step falls through on failure rather than showing a broken image, so an
 * account with no photo, no Gravatar and no name still renders something square.
 */
export function Avatar({
  userId,
  name,
  email,
  avatarUpdatedAt,
  size = 32,
}: AvatarProps): ReactElement {
  const [step, setStep] = useState<'photo' | 'gravatar' | 'monogram'>(
    avatarUpdatedAt ? 'photo' : 'monogram',
  );
  const [gravatar, setGravatar] = useState<string | null>(null);

  // The upload can land while this component is mounted (the Account screen
  // refreshes `/me`), so the starting step is re-derived rather than frozen.
  useEffect(() => {
    setStep(avatarUpdatedAt ? 'photo' : 'monogram');
  }, [avatarUpdatedAt]);

  useEffect(() => {
    if (step !== 'gravatar' || !email) return;
    let alive = true;
    void gravatarUrl(email, size * 2).then((url) => {
      if (!alive) return;
      if (url) setGravatar(url);
      else setStep('monogram');
    });
    return () => {
      alive = false;
    };
  }, [step, email, size]);

  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };

  if (step === 'photo') {
    return (
      <img
        className="avatar"
        style={style}
        src={`/api/avatar/${userId}?v=${encodeURIComponent(avatarUpdatedAt ?? '')}`}
        alt=""
        width={size}
        height={size}
        onError={() => setStep(email ? 'gravatar' : 'monogram')}
      />
    );
  }

  if (step === 'gravatar' && gravatar) {
    return (
      <img
        className="avatar"
        style={style}
        src={gravatar}
        alt=""
        width={size}
        height={size}
        // Gravatar should see the request, not the console URL it came from.
        referrerPolicy="no-referrer"
        onError={() => setStep('monogram')}
      />
    );
  }

  const initials =
    (name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?';

  return (
    <span className="avatar avatar-monogram" style={style} aria-hidden="true">
      {initials}
    </span>
  );
}
