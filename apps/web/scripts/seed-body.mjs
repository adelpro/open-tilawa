import { escapeHtml } from './html.mjs';

/**
 * The static words of `/seed`.
 *
 * The app renders the same page from the same strings; this copy exists so a
 * crawler, and a reader without JavaScript, still get the client, the list's
 * promise, and the node manual folded behind its summaries.
 *
 * It writes no magnet on purpose: the list is the catalogue's, and a static row
 * would go stale the first time a reciter is added.
 */
export function seedBody(page, { command, peerPortCommand, clients }) {
  const escape = escapeHtml;

  /** Summary + body, the same shape the page renders as a `<details>`. */
  const fold = (title, body) =>
    `<details><summary>${escape(title)}</summary>${body}</details>`;

  return (
    `<h1>${escape(page.title)}</h1><p>${escape(page.lede)}</p>` +
    `<nav aria-label="${escape(page.anchors.label)}"><span>${escape(page.anchors.label)}</span>` +
    `<a href="#clients">${escape(page.anchors.app)}</a>` +
    `<a href="#magnets">${escape(page.anchors.list)}</a>` +
    `<a href="#operators">${escape(page.anchors.node)}</a></nav>` +
    `<h2>${escape(page.clients.title)}</h2><ul>` +
    clients.map((client) => `<li><a href="${escape(client.url)}">${escape(client.name)}</a></li>`).join('') +
    `</ul><p>${escape(page.clients.lede)}</p>` +
    `<p>${escape(page.clients.running)}</p><p>${escape(page.clients.delay)}</p>` +
    `<h2>${escape(page.magnets.title)}</h2><p>${escape(page.magnets.lede)}</p>` +
    `<h2>${escape(page.operators.title)}</h2><p>${escape(page.operators.lede)}</p>` +
    `<h3>${escape(page.why.title)}</h3>` +
    `<p>${escape(page.why.p1)}</p><p>${escape(page.why.p2)}</p>` +
    fold(
      page.supported.title,
      `<p>${escape(page.supported.linux)}</p><p>${escape(page.supported.windows)}</p>` +
        `<p>${escape(page.supported.mac)}</p>`,
    ) +
    fold(
      page.linux.title,
      `<p>${escape(page.linux.intro)}</p><ul>` +
        page.linux.requirements.map((item) => `<li>${escape(item)}</li>`).join('') +
        `</ul><pre dir="ltr"><code>${escape(command)}</code></pre>` +
        `<p>${escape(page.linux.commandHint)}</p>` +
        `<pre dir="ltr"><code>${escape(peerPortCommand)}</code></pre>` +
        `<p>${escape(page.linux.portHint)}</p>` +
        `<h3>${escape(page.linux.afterTitle)}</h3><p>${escape(page.linux.afterBody)}</p>`,
    ) +
    fold(
      page.windows.title,
      `<p>${escape(page.windows.warning)}</p><ol>` +
        page.windows.steps.map((step) => `<li>${escape(step.title)} ${escape(step.body)}</li>`).join('') +
        `</ol>`,
    ) +
    fold(
      page.console.title,
      `<p>${escape(page.console.p1)}</p><p>${escape(page.console.p2)}</p>`,
    ) +
    fold(
      page.limits.title,
      `<dl>` +
        page.limits.items
          .map((item) => `<dt>${escape(item.title)}</dt><dd>${escape(item.body)}</dd>`)
          .join('') +
        `</dl>`,
    ) +
    fold(
      page.faq.title,
      `<dl>` +
        page.faq.items
          .map((item) => `<dt>${escape(item.q)}</dt><dd>${escape(item.a)}</dd>`)
          .join('') +
        `</dl>`,
    )
  );
}
