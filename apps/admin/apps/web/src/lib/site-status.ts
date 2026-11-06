import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** The API's view of the deployed site, mirrored so the console can render it. */
export interface SiteRelease {
  slug: string;
  name: string;
  riwaya: string;
}

export interface SiteBuild {
  status: 'running' | 'ok' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  actorId: number | null;
  deployedCount: number | null;
}

export interface SiteStatus {
  state: 'in-sync' | 'drift' | 'unknown' | 'building' | 'failed';
  deployedAt: string | null;
  deployedCount: number | null;
  added: SiteRelease[];
  removed: SiteRelease[];
  renamed: { slug: string; from: SiteRelease; to: SiteRelease }[];
  building: boolean;
  lastBuild: SiteBuild | null;
  blockedBy: 'dirty-tree' | 'building' | 'unsupported' | null;
  dirtyFiles: string[];
  treeError: string | null;
  manifestError: string | null;
  canRebuild: boolean;
}

/**
 * The drift check, refreshed when the catalogue changes and polled while a build
 * runs. The server owns the comparison; this hook only decides when to ask again.
 */
export function useSiteStatus(active: boolean, version: unknown): {
  status: SiteStatus | null;
  error: string | null;
  refresh: () => void;
} {
  const [status, setStatus] = useState<SiteStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!active) return;
    api<SiteStatus>('/reciters/site')
      .then((next) => {
        setStatus(next);
        setError(null);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : 'could not check the deployed site');
      });
  }, [active]);

  // `version` is the catalogue array identity: every save, publish, delete and
  // import completion replaces it, so the notice never shows yesterday's answer.
  useEffect(() => {
    refresh();
  }, [refresh, version]);

  useEffect(() => {
    if (!active || !status?.building) return;
    const timer = window.setInterval(refresh, 5_000);
    return () => window.clearInterval(timer);
  }, [active, status?.building, refresh]);

  return { status, error, refresh };
}
