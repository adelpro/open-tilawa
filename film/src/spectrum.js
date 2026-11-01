/* The spectrum, in the two shapes the film ships: bars (`peaks`) and waves (`ribbon`).
 *
 * `?mode=bars` (default) draws window.WP, one entry per film frame.
 * `?mode=waves` draws window.WV, the pushed values of the app's scrolling ribbon.
 * Both are ports of apps/web/src/components/visualiser.tsx; data comes from
 * src/data.py. Spectrum.draw(t) is a pure function of time, so a frame can be
 * rendered in any order.
 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 520, H = 160;
  const FRONT = '#1c4d78', BACK = '#5d97c9', LINE = '#e8e8e8';

  function parseHex(v) { v = v.replace('#', ''); return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)); }
  function mixHex(a, b, t) {
    const A = parseHex(a), B = parseHex(b);
    return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * Math.min(1, Math.max(0, t))).toString(16).padStart(2, '0')).join('');
  }
  const TINTS = [0, 1 / 3, 2 / 3, 1].map(t => mixHex(FRONT, BACK, t));

  const mode = (new URLSearchParams(location.search).get('mode') || 'bars') === 'waves' ? 'waves' : 'bars';

  /* ---- bars: drawPeaks ---- */
  const BARS = 28, GAP = 3;
  const BW = Math.max(2, (W - GAP * (BARS - 1)) / BARS);
  const xFor = i => W - BW - i * (BW + GAP);
  const hFor = level => Math.pow(level, 0.65) * H;

  /* ---- waves: drawWaves ---- */
  const POINTS = 240;
  const GAINS = [1, 0.8, 0.62, 0.46];            // WAVES[].gain
  const ALPHA = [0.72, 0.55, 0.42, 0.30];        // WAVE_ALPHA
  const STEP = W / (POINTS - 1);
  const AMPLITUDE = H - 6;

  let svg, barEls = [], capEls = [], pathEls = [];

  function init(host) {
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    if (mode === 'bars') {
      for (let i = 0; i < BARS; i++) {
        const b = document.createElementNS(NS, 'rect');
        b.setAttribute('fill', TINTS[0]); b.setAttribute('x', xFor(i).toFixed(2));
        b.setAttribute('width', BW.toFixed(2)); b.setAttribute('height', 0); b.setAttribute('y', H);
        svg.appendChild(b); barEls.push(b);
      }
      for (let i = 0; i < BARS; i++) {
        const c = document.createElementNS(NS, 'rect');
        c.setAttribute('fill', TINTS[0]); c.setAttribute('x', xFor(i).toFixed(2));
        c.setAttribute('width', BW.toFixed(2)); c.setAttribute('height', 1.5); c.setAttribute('y', H - 2);
        svg.appendChild(c); capEls.push(c);
      }
    } else {
      // back to front, so the deepest tint is the nearest silhouette
      for (let layer = 3; layer >= 0; layer--) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('fill', TINTS[layer]); p.setAttribute('fill-opacity', ALPHA[layer]);
        svg.appendChild(p); pathEls[layer] = p;
      }
      const floor = document.createElementNS(NS, 'rect');
      floor.setAttribute('x', 0); floor.setAttribute('y', H - 1);
      floor.setAttribute('width', W); floor.setAttribute('height', 1); floor.setAttribute('fill', LINE);
      svg.appendChild(floor);
    }
    host.appendChild(svg);
  }

  function drawBars(t) {
    const frame = Math.round(t * 30);
    const data = window.WP[Math.max(0, Math.min(window.WP.length - 1, frame))];
    for (let i = 0; i < BARS; i++) {
      const level = data[i], peak = data[BARS + i];
      const h = hFor(level);
      barEls[i].setAttribute('height', h.toFixed(2));
      barEls[i].setAttribute('y', (H - h).toFixed(2));
      if (peak > 0) {
        capEls[i].setAttribute('y', (H - hFor(peak) - 2).toFixed(2));
        capEls[i].setAttribute('visibility', 'visible');
      } else capEls[i].setAttribute('visibility', 'hidden');
    }
  }

  function drawWaves(t) {
    const V = window.WV;
    const k = Math.floor(t / V.push_s + 1e-9);
    const phase = Math.min(1, Math.max(0, (t - k * V.push_s) / V.push_s));
    const auto = V.auto[Math.max(0, Math.min(V.auto.length - 1, Math.floor(t * V.fps)))];
    for (let layer = 0; layer < 4; layer++) {
      const hist = V.push[layer], gain = GAINS[layer];
      const at = i => { const idx = k - i - V.k0; return idx >= 0 && idx < hist.length ? hist[idx] : 0; };
      const yFor = v => H - Math.pow(Math.min(1, v * auto * gain), 0.7) * AMPLITUDE;
      let d = `M${W},${H}L${W},${yFor(at(0)).toFixed(2)}`;
      for (let i = 0; i < POINTS; i++) d += `L${(W - (i + phase) * STEP).toFixed(2)},${yFor(at(i)).toFixed(2)}`;
      d += `L${(W - (POINTS - 1 + phase) * STEP).toFixed(2)},${H}Z`;
      pathEls[layer].setAttribute('d', d);
    }
  }

  window.Spectrum = { mode, init, draw: t => (mode === 'bars' ? drawBars(t) : drawWaves(t)) };
})();
