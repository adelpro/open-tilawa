'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import ReciterPage from '@/app/reciter/[id]/reciter-page';
import UnderConstruction from '@/components/under-construction';
import { loadState } from '@/hooks/use-persistence';
import { APP_VERSION } from '@/constants/version';

import Logo from './logo';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const st = loadState();
    if (st.reciterId) {
      router.replace(`/reciter/${st.reciterId}`);
    }
  }, [router]);

  return (
    <div className="flex w-full flex-col items-center justify-center bg-background text-foreground">
      <Logo />
      <ReciterPage id={undefined} />
      <p className="mt-4 text-center text-xs text-gray-400">Open Quran v{APP_VERSION}</p>
      <UnderConstruction />
    </div>
  );
}
