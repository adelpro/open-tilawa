import Image from 'next/image';

// One brand mark: the تلاوة logo carries the wordmark itself, so no
// additional heading lives beside it.
export default function Logo() {
  return (
    <div className="mt-10 flex w-full items-center justify-center">
      <Image
        src="/images/logo.png"
        alt="تلاوة"
        width={200}
        height={200}
        priority
      />
    </div>
  );
}
