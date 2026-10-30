import { parseMediaLines, totalBySurah } from './media-log';

/**
 * Lines are the combined format nginx writes, trimmed to what matters: the request, the
 * status and the bytes actually sent.
 */
const line = (path: string, status: string, bytes: string) =>
  `203.0.113.9 - - [30/Oct/2026:10:00:00 +0000] "GET ${path} HTTP/2.0" ${status} ${bytes} "-" "Mozilla/5.0"`;

describe('parseMediaLines', () => {
  it('counts a served MP3 range', () => {
    const [entry] = parseMediaLines([line('/media/Abdulbasit_Abdulsamad_Mojawwad/002.mp3', '206', '1048576')]);
    expect(entry).toEqual({ reciter: 'Abdulbasit_Abdulsamad_Mojawwad', surah: 2, bytes: 1048576 });
  });

  it('ignores a 404, a HEAD and an unrelated path', () => {
    expect(
      parseMediaLines([
        line('/media/Abdulbasit_Abdulsamad_Mojawwad/002.mp3', '404', '153'),
        '203.0.113.9 - - [30/Oct/2026:10:00:00 +0000] "HEAD /media/x/002.mp3 HTTP/2.0" 200 0 "-" "-"',
        line('/favicon.svg', '200', '1024'),
      ]),
    ).toEqual([]);
  });

  it('ignores a surah outside the mushaf', () => {
    expect(parseMediaLines([line('/media/x/200.mp3', '200', '500')])).toEqual([]);
  });

  it('adds the bytes of one surah across requests', () => {
    const totals = totalBySurah([
      line('/media/x/002.mp3', '206', '1000'),
      line('/media/x/002.mp3', '206', '2000'),
      line('/media/x/003.mp3', '200', '700'),
    ]);
    expect(totals.get('x/2')).toBe(3000);
    expect(totals.get('x/3')).toBe(700);
  });
});
