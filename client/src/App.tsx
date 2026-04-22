// Foundation placeholder. Screens land in session 2 — see SESSION_PLAN.md.
//
// This page renders the design tokens as swatches so you can visually confirm
// the Tailwind + tokens.ts pipeline is wired end-to-end. When we build the
// real screens next session, replace this file with a BrowserRouter setup.

import { T } from './tokens';

export function App() {
  const swatches: Array<[string, string]> = [
    ['bg', T.bg],
    ['surface', T.surface],
    ['card', T.card],
    ['cardHover', T.cardHover],
    ['border', T.border],
    ['borderLight', T.borderLight],
    ['accent', T.accent],
    ['accentDark', T.accentDark],
    ['gold', T.gold],
    ['green', T.green],
    ['red', T.red],
    ['blue', T.blue],
    ['purple', T.purple],
    ['text', T.text],
    ['textMid', T.textMid],
    ['textDim', T.textDim],
  ];

  return (
    <main className="min-h-full bg-bg text-text p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-3xl font-semibold tracking-tight">Flick</h1>
          <span className="num text-text-mid">v0.1.0 — foundation</span>
        </div>
        <p className="text-text-mid mb-8">
          Backend, auth, webhooks, RLS and design tokens are in place. Screens
          arrive next session. See{' '}
          <code className="bg-card px-1 py-0.5 rounded-sm">SESSION_PLAN.md</code>.
        </p>

        <section className="rounded-card border border-border bg-card p-6 shadow-warm">
          <h2 className="text-sm uppercase tracking-wider text-text-mid mb-4">
            Design tokens
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {swatches.map(([name, hex]) => (
              <div
                key={name}
                className="rounded-md border border-border-light overflow-hidden bg-surface"
              >
                <div className="h-12" style={{ background: hex }} />
                <div className="px-3 py-2">
                  <div className="text-xs text-text">{name}</div>
                  <div className="num text-xs text-text-mid">{hex}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-card border border-border bg-card p-6 shadow-warm">
          <h2 className="text-sm uppercase tracking-wider text-text-mid mb-3">
            Backend check
          </h2>
          <p className="text-text-mid text-sm">
            Run <code className="bg-surface px-1 rounded">npm run dev</code> from the repo root,
            then open{' '}
            <code className="bg-surface px-1 rounded">
              {import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1/health
            </code>
            . It should return <code className="bg-surface px-1 rounded">{'{ "status": "ok" }'}</code>.
          </p>
        </section>
      </div>
    </main>
  );
}
