import re

p = 'index32.html'
s = open(p).read()

# ---- the new seek: 32 s, eight shots ----
start = s.index('function cameraAt(t){')
end = s.index('window.__seek = seek;')
new_js = r'''function cameraAt(t){
  /* 1. the page, 0–7.20: pull back, turn, push into the first voice */
  if (t < 4.20){ const k = easeOut(t/4.20); return [1.30 - 0.14*k, 960, 600 - 44*k]; }
  if (t < 7.20){ const k = easeInOut((t-4.20)/3.00); return [1.16 + 2.04*k, 960 - 10*k, 556 + 129*k]; }
  /* 2. the roster, 7.20–10.00 */
  if (t < 10.0){
    if (t < 7.75) return [1.00, 960, 480];
    if (t < 8.55){ const k = easeInOut((t-7.75)/0.80); return [1.00 + 2.20*k, 960 + 780*k, 480 + 120*k]; }
    if (t < 9.30){ const k = (t-8.55)/0.75; return [3.20 + 0.05*k, 1740, 600]; }
    const k = easeIn((t-9.30)/0.48);
    return [3.25 + (1.00-3.25)*k, 1740 + (960-1740)*k, 600 + (480-600)*k];
  }
  /* 3. the second voice, 10.00–13.80 */
  if (t < 13.80){
    if (t < 13.00){ const k = easeInOut((t-10.0)/3.0); return [1.00 + 3.20*k, 960 - 8*k, 480 + 250*k]; }
    const k = (t-13.0)/0.80;
    return [4.20 + 0.04*k, 952, 730 - 7*k];
  }
  /* 4. the mushaf, 13.80–17.40 */
  if (t < 17.40){
    if (t < 14.35) return [1.00, 960, 480];
    if (t < 15.40){ const k = easeInOut((t-14.35)/1.05); return [1.00 + 1.40*k, 960 + 780*k, 480 + (250-480)*k]; }
    if (t < 16.95){ const k = (t-15.40)/1.55; return [2.40 + 0.04*k, 1740, 250 - 3*k]; }
    const k = easeIn((t-16.95)/0.45);
    return [2.44 + (1.00-2.44)*k, 1740 + (960-1740)*k, 247 + (480-247)*k];
  }
  /* 5. the ring, 17.40–21.40 */
  if (t < 21.40){
    if (t < 17.95) return [1.00, 960, 480];
    if (t < 19.20){ const k = easeInOut((t-17.95)/1.25); return [1.00 + 0.70*k, 960 + 780*k, 480 + (320-480)*k]; }
    if (t < 20.95){ const k = (t-19.20)/1.75; return [1.70 + 0.03*k, 1740, 320 - 3*k]; }
    const k = easeIn((t-20.95)/0.45);
    return [1.73 + (1.00-1.73)*k, 1740 + (960-1740)*k, 317 + (480-317)*k];
  }
  /* 6. the stream, 21.40–26.20 */
  if (t < 26.20){
    if (t < 21.95) return [1.00, 960, 480];
    if (t < 22.60){ const k = easeInOut((t-21.95)/0.65); return [1.00 + 1.00*k, 960 + 780*k, 480 + (300-480)*k]; }
    if (t < 25.75){ const k = (t-22.60)/3.15; return [2.00 + 0.04*k, 1740, 300 - 3*k]; }
    const k = easeIn((t-25.75)/0.45);
    return [2.04 + (1.00-2.04)*k, 1740 + (960-1740)*k, 297 + (480-297)*k];
  }
  /* 7. the page again, 26.20–29.40 */
  if (t < 29.40){ const k = (t-26.20)/3.20; return [1.20 + 0.02*k, 960, 560 - 4*k]; }
  /* 8. the close, 29.40–32.00 */
  const k = (t-29.40)/2.60;
  return [2.60 + 0.02*k, 960, 704 - 3*k];
}

/* which panel is docked, and how far it is in (0 = open, 360 = gone) */
function panelAt(t){
  const dockIn = (a, b) => { const k = easeOut((t-a)/(b-a)); return [360*(1-k), -180*k]; };
  const dockOut = (a, b) => { const k = easeIn((t-a)/(b-a)); return [360*k, -180*(1-k)]; };
  if (t >= 7.20 && t < 10.0){
    if (t < 7.75) return ['reciters', ...dockIn(7.20, 7.75)];
    if (t < 9.30) return ['reciters', 0, -180];
    return ['reciters', ...dockOut(9.30, 9.78)];
  }
  if (t >= 13.80 && t < 17.40){
    if (t < 14.35) return ['surahs', ...dockIn(13.80, 14.35)];
    if (t < 16.95) return ['surahs', 0, -180];
    return ['surahs', ...dockOut(16.95, 17.40)];
  }
  if (t >= 17.40 && t < 21.40){
    if (t < 17.95) return ['account', ...dockIn(17.40, 17.95)];
    if (t < 20.95) return ['account', 0, -180];
    return ['account', ...dockOut(20.95, 21.40)];
  }
  if (t >= 21.40 && t < 26.20){
    if (t < 21.95) return ['stream', ...dockIn(21.40, 21.95)];
    if (t < 25.75) return ['stream', 0, -180];
    return ['stream', ...dockOut(25.75, 26.20)];
  }
  return [null, 360, 0];
}

/* ---------- the four panels ---------- */
const SURAHS = [
  ['الفاتحة','7 آيات · الجزء 1','804 KB'], ['البقرة','286 آية · الجزء 1','119 MB'],
  ['آل عمران','200 آية · الجزء 3','68 MB'], ['النساء','176 آية · الجزء 4','75 MB'],
  ['المائدة','120 آية · الجزء 6','57 MB'], ['الأنعام','165 آية · الجزء 7','62 MB'],
  ['الأعراف','206 آية · الجزء 8','66 MB'], ['الأنفال','75 آية · الجزء 9','25 MB'],
  ['التوبة','129 آية · الجزء 10','50 MB'], ['يونس','109 آية · الجزء 11','36 MB'],
  ['هود','123 آية · الجزء 11','37 MB'], ['يوسف','111 آية · الجزء 12','39 MB'],
  ['الرعد','43 آية · الجزء 13','25 MB'], ['إبراهيم','52 آية · الجزء 13','26 MB'],
];
document.getElementById('surahRows').innerHTML = SURAHS.map(([name, meta, size], i) => `
  <li><div class="srow ${i === 0 ? 'cur' : ''}">
    <span class="num">${i + 1}</span>
    <span class="txt"><span class="nm">${name}</span><span class="meta">${meta}</span></span>
    <span class="size">${size}</span>
  </div></li>`).join('');

const S = (label, iconName, id) => `<div class="srow2"><span class="sl">${iconName ? icon(iconName, 18) : ''}${label}</span><span class="sv" id="${id}"></span></div>`;
document.getElementById('streamRows').innerHTML = `
  ${S('المصدر', 'WifiHigh', 'sv-source')}
  ${S('الأقران', 'Users', 'sv-peers')}
  ${S('التنزيل', 'DownloadSimple', 'sv-down')}
  ${S('الرفع', 'UploadSimple', 'sv-up')}
  ${S('المُنزَّل', 'DownloadSimple', 'sv-done')}
  ${S('التقدّم', 'Pulse', 'sv-prog')}
  ${S('الملفات', 'File', 'sv-files')}
  ${S('البديل', 'LinkSimple', 'sv-fallback')}
  <p class="snote" id="sv-note">لم يتصل أي قارئ بعد. التشغيل يبدأ عندما يظهر أوّل قرين.</p>`;

document.getElementById('i-pin2').innerHTML = icon('PushPin', 20);
document.getElementById('i-close2').innerHTML = icon('X', 20);
document.getElementById('i-close3').innerHTML = icon('X', 20);
document.getElementById('i-close4').innerHTML = icon('X', 20);
document.getElementById('i-search2').innerHTML = icon('MagnifyingGlass', 20);
document.getElementById('i-search').innerHTML = icon('MagnifyingGlass', 20);

const PANELS = {
  reciters: document.getElementById('panel'),
  surahs: document.getElementById('panel-surahs'),
  account: document.getElementById('panel-account'),
  stream: document.getElementById('panel-stream'),
};
const sv = {
  source: document.getElementById('sv-source'),
  peers: document.getElementById('sv-peers'),
  down: document.getElementById('sv-down'),
  up: document.getElementById('sv-up'),
  done: document.getElementById('sv-done'),
  prog: document.getElementById('sv-prog'),
  files: document.getElementById('sv-files'),
  fallback: document.getElementById('sv-fallback'),
  note: document.getElementById('sv-note'),
};
const ringName = document.getElementById('ringName');
const ringCaret = document.getElementById('ringCaret');

function seek(t){
  t = Math.max(0, Math.min(DUR - 1e-4, t));
  const f = Math.round(t * FPS);

  const [s, fx, fy] = cameraAt(t);
  cam.style.transform = `translate(960px,540px) scale(${s.toFixed(4)}) translate(${-fx.toFixed(2)}px,${-fy.toFixed(2)}px)`;

  /* panels */
  const [kind, px, shift] = panelAt(t);
  for (const [name, el] of Object.entries(PANELS)){
    const on = name === kind && px < 359.5;
    el.style.display = on ? 'flex' : 'none';
    if (on) el.style.transform = `translateX(${px.toFixed(1)}px)`;
  }
  col.style.transform = `translateX(${shift.toFixed(1)}px)`;

  /* the pick (roster) */
  const picked = t >= 9.08;
  rowEls.forEach((el, i) => el.classList.toggle('cur', picked ? i === 4 : i === 5));
  const name = picked ? 'محمود خليل الحصري' : 'محمد صديق المنشاوي';
  reciterEl.firstChild.nodeValue = name;
  micEl.textContent = name;

  /* the arrow */
  if (t >= 8.20 && t < 9.80){
    let cx, cy;
    if (t < 8.85){ const k = easeOut((t-8.20)/0.65); cx = 1980 + (1690-1980)*k; cy = 760 + (585-760)*k; }
    else if (t < 9.06){ cx = 1690; cy = 585; }
    else { const k = easeIn((t-9.06)/0.74); cx = 1690 + (2120-1690)*k; cy = 585 + (320-585)*k; }
    let sc = 1;
    if (t >= 9.06 && t < 9.16) sc = 1 - 0.10*Math.sin(Math.PI*(t-9.06)/0.10);
    cursor.style.display = 'block';
    cursor.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) scale(${sc.toFixed(3)})`;
  } else {
    cursor.style.display = 'none';
  }

  /* the ring name, typed into the product's field */
  const typed = 'البيت';
  const keys = [19.05, 19.30, 19.55, 19.80, 20.05];
  const n = keys.filter(k => t >= k).length;
  if (kind === 'account'){
    ringName.textContent = typed.slice(0, n);
    ringCaret.style.visibility = t >= 18.9 ? 'visible' : 'hidden';
  }

  /* the stream: waiting until a peer answers */
  const peer = t >= 23.60;
  if (kind === 'stream'){
    sv.source.innerHTML = peer ? `${icon('WifiHigh', 18)}P2P` : `${icon('WifiHigh', 18)}بانتظار الأقران`;
    sv.peers.textContent = peer ? '1' : '0';
    sv.down.textContent = peer ? '853 KB/s' : '—';
    sv.up.textContent = peer ? '110 B/s' : '—';
    sv.done.textContent = '0 B';
    sv.prog.textContent = '0.0%';
    sv.files.textContent = peer ? '114' : '0';
    sv.fallback.textContent = 'متوفّر';
    sv.note.style.display = peer ? 'none' : 'block';
  }

  /* clock */
  const audio = t < 10.0 ? 2.00 + t : 10.00 + t;
  const total = t < 10.0 ? 51.3 : 34.25;
  posEl.textContent = mmss(Math.min(total, audio));
  durEl.textContent = mmss(total);
  fillEl.style.width = Math.min(100, (audio/total)*100).toFixed(1) + '%';

  /* the mark: 30.50 → 31.12, then a creep */
  if (t >= 30.50){
    const k = easeOut((t-30.50)/0.62);
    const creep = Math.min(1, Math.max(0, (t-31.12)/0.88));
    mark.style.opacity = 1;
    mark.style.transform = `translateX(-50%) scale(${(1.18 - 0.18*k - 0.004*creep).toFixed(4)})`;
    mark.style.filter = k < 0.999 ? `blur(${(6*(1-k)).toFixed(2)}px)` : 'none';
  } else {
    mark.style.opacity = 0;
  }

  drawPeaks(f);
}

window.__seek = seek;
window.__duration = 32;
window.__events = [
  { t: 7.20, frame: 216, type: 'cut', label: 'page → roster' },
  { t: 9.08, frame: 272, type: 'press', label: 'pick الحصري' },
  { t: 10.00, frame: 300, type: 'beat', label: 'V2 begins' },
  { t: 13.80, frame: 414, type: 'cut', label: 'macro → السور' },
  { t: 17.40, frame: 522, type: 'cut', label: 'السور → الحساب' },
  { t: 21.40, frame: 642, type: 'cut', label: 'الحساب → تفاصيل البث' },
  { t: 23.60, frame: 708, type: 'beat', label: 'peer connects' },
  { t: 26.20, frame: 786, type: 'cut', label: 'stream → page' },
  { t: 29.40, frame: 882, type: 'cut', label: 'page → close' },
  { t: 30.50, frame: 915, type: 'show', label: 'wordmark' },
];

'''
s = s[:start] + new_js + s[end:]
# drop the 21 s event list that followed the seek assignment
s = s.replace('''window.__events = [
  { t: 7.20, frame: 216, type: 'cut', label: 'page → roster' },
  { t: 9.08, frame: 272, type: 'press', label: 'pick الحصري' },
  { t: 10.00, frame: 300, type: 'beat', label: 'V2 begins' },
  { t: 17.00, frame: 510, type: 'cut', label: 'macro → close' },
  { t: 19.55, frame: 587, type: 'show', label: 'wordmark' },
];

''', '')
s = s.replace('data-duration="21"', 'data-duration="32"')
s = s.replace('const W = 520, H = 160, POINTS = 240, FPS = 30, DUR = 21, SEAM = 10.0;',
              'const W = 520, H = 160, POINTS = 240, FPS = 30, DUR = 32, SEAM = 10.0;')
open(p, 'w').write(s)
print('seek replaced; length', len(s))
