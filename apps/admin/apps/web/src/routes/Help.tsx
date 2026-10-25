import type { ReactElement } from 'react';
import { Panel } from '../components/Panel';

const sections: { title: string; body: string }[] = [
  {
    title: 'Profiles',
    body: 'List, create, rename and choose your default voice profile. Each profile holds a manifest, house style, learned preferences and a voice card. Open one to edit its toolchain or generate it from samples.',
  },
  {
    title: 'Profile editor',
    body: 'Edit the manifest, house style, voice prose, toolchain (gates and prompts), sample count and master step. Gates run in order; prompt steps are applied by the client model; the master composes them at the end.',
  },
  {
    title: 'Keys',
    body: 'Mint per-client API keys with scopes (profile:read, profile:write, gate:run). The plaintext is shown once. Revoke by prefix. Keys authenticate the MCP server and the stdio bridge.',
  },
  {
    title: 'Usage',
    body: 'Per-tool call counts and audit trail for your account. Shows recent gate runs and which keys were used.',
  },
  {
    title: 'Account',
    body: 'Profile name/about, language and theme, photo, password, email change, two-factor, trusted devices, master step, and account deletion. Tabs switch between sections; devices and security stay visible.',
  },
  {
    title: 'Admin / Super admin console',
    body: 'Search users, disable/enable, change roles (super admin), delete users, mint keys, view gate health and audit log. Filter by role or status. Super admin has the irreversible verbs.',
  },
  {
    title: 'MCP tools',
    body: 'Seven tools over /mcp: get_profile, manage_profile, learn_preference, run_gate, doctor, render_profile, generate_profile. Three prompts: write, audit, fasaha. Authenticated by Bearer key.',
  },
  {
    title: 'House style',
    body: 'Register and mechanics the gate enforces: straight quotes, latin abbreviations in parentheses, serial comma, no hype. Editable per profile.',
  },
  {
    title: 'Voice card',
    body: 'A self-contained summary of a voice, pasteable into any chat or agent. Generated from voice prose.',
  },
  {
    title: 'Master step',
    body: 'An optional post-gate revision pass. Account default runs when a profile has none.',
  },
  {
    title: 'Setup and recovery',
    body: 'First sign-in uses a setup token printed in the API log. Recovery: password reset by email, 2FA email code, recovery codes, or CLI break-glass.',
  },
];

export function Help(): ReactElement {
  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1 className="display-lg">Help</h1>
          <p className="body muted">Documentation for every section of Uslub.</p>
        </div>
      </header>
      {sections.map((s) => (
        <Panel key={s.title}>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{s.title}</summary>
            <p className="body" style={{ marginTop: 'var(--space-3)' }}>{s.body}</p>
          </details>
        </Panel>
      ))}
    </div>
  );
}
