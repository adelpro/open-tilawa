'use client';
import { useAtomValue } from 'jotai';
import Image from 'next/image';
import React, { useState } from 'react';

import useTorrent from '@/hooks/use-torrent';
import { selectedReciterAtom, webtorrentReadyAtom } from '@/jotai/atom';
import connectionSVG from '@/svgs/connection.svg';
import connectionAnimatedSVG from '@/svgs/connection-animated.svg';
import searchSVG from '@/svgs/search.svg';

import ReciterSelectorDialog from './reciter-selector-dialog';
import TorrentInfoDialog from './torrent-info-dialog';

export default function ReciterSelector() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [torrentInfoIsOpen, setTorrentInfoIsOpen] = useState<boolean>(false);
  const webtorrentReady = useAtomValue(webtorrentReadyAtom);
  const { torrentInfo } = useTorrent();
  const selectedReciterValue = useAtomValue(selectedReciterAtom);
  const onButtonClick = () => setIsOpen(true);

  if (!webtorrentReady) return <></>;

  return (
    <div className="flex w-full flex-row items-center justify-center gap-2">
      {selectedReciterValue && (
        <button
          onClick={() => setTorrentInfoIsOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
          title="معلومات الاتصال"
        >
          {torrentInfo && torrentInfo.magnetURI ? (
            <Image src={connectionSVG} alt="connected" width={18} height={18} />
          ) : (
            <Image
              src={connectionAnimatedSVG}
              alt="connecting"
              width={18}
              height={18}
            />
          )}
        </button>
      )}
      <button
        className="flex h-9 flex-1 items-center rounded-full bg-slate-100 px-4 text-sm transition-colors hover:bg-slate-200"
        onClick={onButtonClick}
      >
        <span className="flex-1 truncate text-right">
          {selectedReciterValue ? selectedReciterValue.name : 'اختر القارئ'}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {selectedReciterValue && (
            <span
              className="rounded border border-hairline bg-canvas px-1.5 py-0.5 text-[10px] text-ink-secondary"
              title="مصدر الملفات"
            >
              {selectedReciterValue.source}
            </span>
          )}
          <Image src={searchSVG} alt="search" width={16} height={16} />
        </span>
      </button>
      <ReciterSelectorDialog isOpen={isOpen} setIsOpen={setIsOpen} />
      <TorrentInfoDialog
        isOpen={torrentInfoIsOpen}
        setIsOpen={setTorrentInfoIsOpen}
      />
    </div>
  );
}
