'use client';


import { useSetAtom } from 'jotai';
import dynamic from 'next/dynamic';
import React, { useEffect } from 'react';

import PwaUpdater from '@/components/pwa-updater';
import { selectedReciterAtom } from '@/jotai/atom';
import { saveState } from '@/hooks/use-persistence';
import { useReciters } from '@/hooks/use-reciters';
import { Reciter } from '@/types';

import ReciterSelector from '../../../components/reciter-selector';

type Props = { id: number | undefined };
export default function ReciterPage({ id }: Props) {
  const Torrent = dynamic(() => import('@/components/torrrent'), {
    ssr: false,
  });
  const setSelectedReciter = useSetAtom(selectedReciterAtom);

  const { reciters } = useReciters();

  useEffect(() => {
    if (!id) {
      setSelectedReciter(undefined);
      return;
    }
    const selectedReciter: Reciter | undefined = reciters.find(
      (r) => r.id === Number(id)
    );
    if (!selectedReciter) {
      setSelectedReciter(undefined);
      return;
    }
    setSelectedReciter(selectedReciter);
    if (selectedReciter) saveState({ reciterId: selectedReciter.id });
  }, [id, reciters, setSelectedReciter]);

  return (
    <div className="flex w-full items-center justify-center p-2 md:p-5">
      <div className="flex w-full max-w-lg flex-col items-center justify-center gap-2">
        <ReciterSelector />
        <Torrent />
        <PwaUpdater />
      </div>
    </div>
  );
}
