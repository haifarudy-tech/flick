import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { T } from '@/tokens';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: T.bg,
        color: T.text,
      }}
    >
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </main>
    </div>
  );
}
