/*
 * Before paint: the console's mode and paper are local decisions, and a frame
 * of the wrong one is a flash. The provider re-applies both; this only wins the
 * first paint.
 *
 * A file rather than an inline script because the console's CSP is
 * `script-src 'self'`: inline would be blocked, and the block is not silent.
 */
(function () {
  try {
    var stored = localStorage.getItem('tilawa.theme');
    var dark =
      stored === 'dark' ||
      (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var paper = localStorage.getItem('tilawa.palette');
    if (paper) document.documentElement.setAttribute('data-palette', paper);
  } catch (error) {
    /* private mode: the provider still applies both on mount */
  }
})();
