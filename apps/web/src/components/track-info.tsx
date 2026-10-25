import React from 'react';

import { SURAHS } from '@/constants';
import { formatTime } from '@/utils';

type Props = {
  currentTrackId: number;
  duration: number;
  currentTime: number;
  playlist?: { surahId: number }[];
};
export default function TrackInfo({
  currentTrackId,
  duration,
  currentTime,
  playlist,
}: Props) {
  const currentTrack = playlist ? playlist[currentTrackId] : undefined;
  const surahId = currentTrack?.surahId ?? currentTrackId + 1;
  const surahName = SURAHS.find((surah) => surah.id === surahId)?.name;

  return (
    <div className="flex items-center justify-center gap-2 font-bold text-gray-500">
      <span>{`${surahId} - ${surahName}`}</span>
      <span>{`(${formatTime(currentTime)} ${formatTime(duration)})`}</span>
    </div>
  );
}
