import React from 'react';

import { SURAHS } from '@/constants';
import type { TrackType } from '@/types';

type Props = {
  playlist: TrackType[];
  setIsOpen: (isOpen: boolean) => void;
  setCurrentTrack: React.Dispatch<React.SetStateAction<number>>;
};

export default function Playlist({ playlist, setIsOpen, setCurrentTrack }: Props) {
  const handlePlylistItemClick = (index: number) => {
    setIsOpen(false);
    setCurrentTrack(index);
  };

  return (
    <main>
      <h1 className="my-2 w-full text-center">السور</h1>
      <ul className="my-2 w-full pl-3 text-right">
        {playlist.map((element, index) => {
          const surahName = SURAHS.find((s) => s.id === element.surahId)?.name;
          return (
            <li
              key={index}
              className="mx-2 my-1 w-full cursor-pointer rounded p-2 text-slate-500 transition-colors duration-300 hover:bg-gray-200 hover:text-slate-800"
              onClick={() => handlePlylistItemClick(index)}
            >
              {surahName ?? (element.surahId > 0 ? `سورة ${element.surahId}` : index + 1)}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
