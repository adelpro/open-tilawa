import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-20 text-center">
      <p className="badge-tech text-ink-tertiary">404</p>
      <h1 className="mt-3 font-display text-[40px] leading-tight">صفحة غير موجودة</h1>
      <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-ink-secondary">
        الرابط الذي فتحته لا يشير إلى صفحة في تلاوة.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-pill bg-ink px-5 py-2.5 text-[13px] font-semibold text-canvas"
      >
        العودة إلى المكتبة
      </Link>
    </div>
  );
}
