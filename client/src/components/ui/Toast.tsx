import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { T } from '@/tokens';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  createdAt: number;
}

interface ToastCtx {
  push: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++idRef.current;
      setToasts((ts) => [...ts, { id, kind, message, createdAt: Date.now() }]);
      window.setTimeout(() => remove(id), kind === 'error' ? 5_000 : 3_000);
    },
    [remove],
  );

  const value = useMemo<ToastCtx>(
    () => ({
      push,
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [enter, setEnter] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setEnter(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const palette = {
    success: { color: T.green, glow: 'rgba(78,168,107,0.12)' },
    error: { color: T.red, glow: 'rgba(201,84,84,0.12)' },
    info: { color: T.blue, glow: 'rgba(74,139,200,0.12)' },
  } as const;
  const p = palette[toast.kind];

  return (
    <div
      style={{
        pointerEvents: 'auto',
        minWidth: 260,
        maxWidth: 380,
        background: T.card,
        border: `1px solid ${p.color}40`,
        borderLeft: `3px solid ${p.color}`,
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: T.text,
        fontSize: 13,
        fontWeight: 600,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        transform: enter ? 'translateY(0)' : 'translateY(12px)',
        opacity: enter ? 1 : 0,
        transition: 'all 0.2s',
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: p.glow,
          color: p.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        {toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '!' : 'i'}
      </div>
      <div style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</div>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: T.textDim,
          cursor: 'pointer',
          fontSize: 14,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
