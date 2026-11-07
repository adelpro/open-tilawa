import CopyCode from '@/components/copy-code';
import Icon from '@/components/icons';
import SeedMagnets from '@/components/seed-magnets';
import {
  CONSOLE_SEEDERS_URL,
  INSTALLER_OUTPUT,
  PEER_PORT_COMMAND,
  installCommand,
} from '@/constants/seeder';
import { useLocale } from '@/hooks/use-locale';

/**
 * Two ways to keep the library alive, in the order a visitor needs them.
 *
 * First: install a torrent app and copy one link — no account, no server of ours
 * as a source. Second, for someone who has a machine to spare: run a node, which
 * is what actually serves the player's swarm. The node instructions are imported
 * from constants, never retyped, and the console keeps its own copy.
 */

const CLIENTS = [
  { name: 'qBittorrent', url: 'https://www.qbittorrent.org/download', key: 'qbittorrent' },
  { name: 'Deluge', url: 'https://deluge-torrent.org/download/', key: 'deluge' },
] as const;

export default function SeedPage() {
  const { t } = useLocale();
  const copy = t.seedPage;
  const command = installCommand({ diskGb: 50, uploadKbps: 20000 });

  return (
    <main className="page-screen">
      <div className="w-full max-w-[520px] lg:max-w-[700px]">
        <div className="seed-hero">
          <h1 className="text-[3rem] font-semibold leading-[1.05] text-ink lg:text-[6rem]">
            {copy.title}
          </h1>
          <p className="mt-5 text-[1.125rem] leading-relaxed text-ink lg:text-[1.25rem]">
            {copy.lede}
          </p>
          <a
            href="#magnets"
            className="press mt-6 inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-[0.9375rem] font-semibold text-invert"
          >
            {copy.cta}
            <Icon name="forward" size={16} className="icon-dir" />
          </a>
        </div>

        <section id="clients" className="seed-section mt-14 scroll-mt-8">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{copy.clients.title}</h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink">{copy.clients.lede}</p>
          <ul className="mt-5 space-y-4">
            {CLIENTS.map((client) => (
              <li key={client.key}>
                <a
                  href={client.url}
                  target="_blank"
                  rel="noreferrer"
                  className="press inline-flex items-center gap-2 text-[1rem] font-semibold text-ink underline"
                >
                  {client.name}
                  <Icon name="forward" size={16} className="icon-dir" />
                </a>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">
                  {copy.clients[client.key]}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[0.9375rem] leading-relaxed text-ink">{copy.clients.running}</p>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">{copy.clients.delay}</p>
        </section>

        <SeedMagnets />

        <section className="seed-section mt-20 border-t border-line pt-10">
          <h2 className="text-[1.5rem] font-semibold leading-snug text-ink">
            {copy.operators.title}
          </h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink">{copy.operators.lede}</p>
        </section>

        <section className="seed-section mt-14">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{copy.why.title}</h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink">{copy.why.p1}</p>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink">{copy.why.p2}</p>
        </section>

        <section className="seed-section mt-14">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">
            {copy.supported.title}
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-start text-[0.9375rem] leading-relaxed">
              <tbody>
                <tr className="odd:bg-line/20">
                  <th scope="row" className="py-3 pe-4 text-start align-top font-semibold text-ink">
                    Linux
                  </th>
                  <td className="py-3 align-top text-muted">{copy.supported.linux}</td>
                </tr>
                <tr className="odd:bg-line/20">
                  <th scope="row" className="py-3 pe-4 text-start align-top font-semibold text-ink">
                    Windows
                  </th>
                  <td className="py-3 align-top text-muted">{copy.supported.windows}</td>
                </tr>
                <tr className="odd:bg-line/20">
                  <th scope="row" className="py-3 pe-4 text-start align-top font-semibold text-ink">
                    macOS
                  </th>
                  <td className="py-3 align-top text-muted">{copy.supported.mac}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="linux" className="seed-section mt-14 scroll-mt-8">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{copy.linux.title}</h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink">{copy.linux.intro}</p>
          <ul className="mt-4 list-disc space-y-2 ps-5 text-[0.9375rem] leading-relaxed text-ink">
            {copy.linux.requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <CopyCode
            value={command}
            title={copy.linux.commandTitle}
            label={copy.copy}
            copiedLabel={copy.copied}
            failedLabel={copy.copyFailed}
          />
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">{copy.linux.commandHint}</p>
          <CopyCode
            value={PEER_PORT_COMMAND}
            title={copy.linux.portTitle}
            label={copy.copy}
            copiedLabel={copy.copied}
            failedLabel={copy.copyFailed}
          />
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">{copy.linux.portHint}</p>
          <figure className="mt-6">
            <img
              src="/images/seeders-terminal.png"
              alt={copy.linux.terminalAlt}
              width={1200}
              height={420}
              className="h-auto w-full"
            />
            <figcaption className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
              {copy.linux.terminalCaption}
            </figcaption>
          </figure>
          <h3 className="mt-6 text-[1rem] font-semibold text-ink">{copy.linux.afterTitle}</h3>
          <p className="mt-2 text-[1rem] leading-relaxed text-ink">{copy.linux.afterBody}</p>
          <h3 className="mt-6 text-[1rem] font-semibold text-ink">{copy.linux.exampleTitle}</h3>
          <pre dir="ltr" className="mt-3 overflow-x-auto bg-line/30 p-4 text-left font-mono text-[0.75rem] leading-relaxed text-ink">
            <code className="whitespace-pre-wrap break-words">{INSTALLER_OUTPUT}</code>
          </pre>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">{copy.linux.exampleHint}</p>
          <figure className="mt-6">
            <img
              src="/images/seeders-commands.png"
              alt={copy.linux.commandsAlt}
              width={616}
              height={748}
              className="h-auto w-full bg-line/20"
            />
            <figcaption className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
              {copy.linux.commandsCaption}
            </figcaption>
          </figure>
        </section>

        <section className="seed-section mt-14">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">
            {copy.windows.title}
          </h2>
          <p className="mt-3 bg-line/30 p-4 text-[0.9375rem] leading-relaxed text-ink">
            {copy.windows.warning}
          </p>
          <CopyCode
            value={copy.windows.command}
            title={copy.windows.commandTitle}
            label={copy.copy}
            copiedLabel={copy.copied}
            failedLabel={copy.copyFailed}
          />
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
            {copy.windows.commandHint}
          </p>
          <ol className="mt-5 list-decimal space-y-4 ps-5">
            {copy.windows.steps.map((step) => (
              <li key={step.title} className="text-[0.9375rem] leading-relaxed text-ink">
                <span className="font-semibold text-ink">{step.title}</span> {step.body}
              </li>
            ))}
          </ol>
          <CopyCode
            value={command}
            title={copy.windows.installTitle}
            label={copy.copy}
            copiedLabel={copy.copied}
            failedLabel={copy.copyFailed}
          />
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
            {copy.windows.installHint}
          </p>
        </section>

        <section className="seed-section mt-14">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{copy.console.title}</h2>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink">{copy.console.p1}</p>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink">{copy.console.p2}</p>
          <a
            href={CONSOLE_SEEDERS_URL}
            target="_blank"
            rel="noreferrer"
            className="press mt-5 inline-flex min-h-10 items-center gap-2 bg-ink px-4 text-[0.875rem] font-semibold text-invert"
          >
            {copy.console.link}
            <Icon name="forward" size={16} className="icon-dir" />
          </a>
          <figure className="mt-6">
            <img
              src="/images/seeders-console.png"
              alt={copy.console.imageAlt}
              width={979}
              height={380}
              className="h-auto w-full bg-line/20"
            />
            <figcaption className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
              {copy.console.imageCaption}
            </figcaption>
          </figure>
          <figure className="mt-6">
            <img
              src="/images/seeders-add-form.png"
              alt={copy.console.formAlt}
              width={616}
              height={748}
              className="h-auto w-full bg-line/20"
            />
            <figcaption className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
              {copy.console.formCaption}
            </figcaption>
          </figure>
        </section>

        <section className="seed-section mt-14">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{copy.limits.title}</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {copy.limits.items.map((item) => (
              <div key={item.title}>
                <dt className="text-[0.9375rem] font-semibold text-ink">{item.title}</dt>
                <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink">{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="seed-section mt-14">
          <h2 className="text-[1.25rem] font-semibold leading-snug text-ink">{copy.faq.title}</h2>
          <dl className="mt-4 space-y-5">
            {copy.faq.items.map((item) => (
              <div key={item.q}>
                <dt className="text-[1rem] font-semibold leading-snug text-ink">{item.q}</dt>
                <dd className="mt-1 text-[1rem] leading-relaxed text-ink">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}
