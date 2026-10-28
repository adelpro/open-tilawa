import Icon from '@/components/icons';
import type { StreamSource } from '@/utils/stream-source';
import { iconForSource } from '@/utils/stream-source';

/**
 * The stream state as a glyph, shared by the footer and the stream sheet.
 * They used to pick their own icons and drifted — a mixed stream was `wifi` in
 * the footer and `server` in the sheet — so the mapping lives in one place now.
 */
export default function StreamSourceIcon({
  source,
  className,
}: {
  source: StreamSource;
  className?: string;
}) {
  return <Icon name={iconForSource(source)} className={className} />;
}
