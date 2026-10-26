import { useCallback, useEffect, useRef, useState } from 'react';

import { secondsLeft, sleepEndsAt } from '@/utils/sleep-timer';

/**
 * A sleep timer that exists only while the tab does. Waking up to silence is the
 * point; surviving a reload is not, and pretending otherwise would need storage
 * and a clock-catchup path for a control used at bedtime.
 */
export function useSleepTimer(onExpire: () => void) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    if (endsAt === null) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      const left = secondsLeft(endsAt);
      setRemaining(left);
      if (left > 0) return;
      setEndsAt(null);
      expire.current();
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const start = useCallback((minutes: number) => {
    setEndsAt(sleepEndsAt(minutes));
  }, []);

  return { active: endsAt !== null, remaining, start };
}
