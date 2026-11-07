import { escapeHtml } from './html.mjs';

/**
 * The static words of `/seed`.
 *
 * The app renders the same page from the same strings; this copy exists so a
 * crawler, and a reader without JavaScript, still get the clients and the list's
 * promise next to the node manual — the title and description now name both.
 *
 * It writes no magnet on purpose: the list is the catalogue's, and a static row
 * would go stale the first time a reciter is added. The page's own list is
 * fetched at runtime by `SeedMagnets`.
 */
export function seedBody(page, { command, peerPortCommand, clients }) {
  const escape = escapeHtml;
  return (
    `<h1>${escape(page.title)}</h1><p>${escape(page.lede)}</p>` +
    `<h2>${escape(page.clients.title)}</h2><p>${escape(page.clients.lede)}</p><ul>` +
    clients
      .map(
        (client) =>
          `<li><a href="${escape(client.url)}">${escape(client.name)}</a> ${escape(
            page.clients[client.key],
          )}</li>`,
      )
      .join('') +
    `</ul><p>${escape(page.clients.running)}</p><p>${escape(page.clients.delay)}</p>` +
    `<h2>${escape(page.magnets.title)}</h2><p>${escape(page.magnets.lede)}</p>` +
    `<h2>${escape(page.operators.title)}</h2><p>${escape(page.operators.lede)}</p>` +
    `<h2>${escape(page.why.title)}</h2><p>${escape(page.why.p1)}</p><p>${escape(page.why.p2)}</p>` +
    `<h2>${escape(page.supported.title)}</h2><p>${escape(page.supported.linux)}</p>` +
    `<p>${escape(page.supported.windows)}</p><p>${escape(page.supported.mac)}</p>` +
    `<h2>${escape(page.linux.title)}</h2><p>${escape(page.linux.intro)}</p><ul>` +
    page.linux.requirements.map((item) => `<li>${escape(item)}</li>`).join('') +
    `</ul><pre dir="ltr"><code>${escape(command)}</code></pre>` +
    `<p>${escape(page.linux.commandHint)}</p>` +
    `<pre dir="ltr"><code>${escape(peerPortCommand)}</code></pre>` +
    `<p>${escape(page.linux.portHint)}</p>` +
    `<h3>${escape(page.linux.afterTitle)}</h3><p>${escape(page.linux.afterBody)}</p>` +
    `<h2>${escape(page.windows.title)}</h2><p>${escape(page.windows.warning)}</p><ol>` +
    page.windows.steps.map((step) => `<li>${escape(step.title)} ${escape(step.body)}</li>`).join('') +
    `</ol>` +
    `<h2>${escape(page.console.title)}</h2><p>${escape(page.console.p1)}</p><p>${escape(page.console.p2)}</p>` +
    `<h2>${escape(page.limits.title)}</h2><dl>` +
    page.limits.items
      .map((item) => `<dt>${escape(item.title)}</dt><dd>${escape(item.body)}</dd>`)
      .join('') +
    `</dl><h2>${escape(page.faq.title)}</h2><dl>` +
    page.faq.items
      .map((item) => `<dt>${escape(item.q)}</dt><dd>${escape(item.a)}</dd>`)
      .join('') +
    `</dl>`
  );
}
