import Dialog from '@components/dialog';
import React from 'react';

import Playlist from '@/components/playlist';
import type { TrackType } from '@/types';

type Props = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  setCurrentTrack: React.Dispatch<React.SetStateAction<number>>;
  playlist: TrackType[];
};

export default function PlaylistDialog({
  isOpen,
  setIsOpen,
  setCurrentTrack,
  playlist,
}: Props): React.ReactNode {
  return (
    <Dialog isOpen={isOpen} setIsOpen={setIsOpen}>
      <Playlist playlist={playlist} setIsOpen={setIsOpen} setCurrentTrack={setCurrentTrack} />
    </Dialog>
  );
}
