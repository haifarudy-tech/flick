import { useCallback, useRef, useState } from 'react';
import { api } from './api';

export type TerminalStage =
  | 'idle'
  | 'loading_sdk'
  | 'discovering'
  | 'connecting'
  | 'ready'
  | 'collecting'
  | 'processing'
  | 'capturing'
  | 'success'
  | 'error';

export const TERMINAL_STAGE_LABEL: Record<TerminalStage, string> = {
  idle: 'Ready',
  loading_sdk: 'Loading Terminal SDK…',
  discovering: 'Searching for reader…',
  connecting: 'Connecting to reader…',
  ready: 'Reader connected',
  collecting: 'Present card to reader…',
  processing: 'Processing payment…',
  capturing: 'Confirming with server…',
  success: 'Payment complete',
  error: 'Payment failed',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTerminal = any;

export interface UseStripeTerminal {
  stage: TerminalStage;
  error: string | null;
  /** Connect to reader (or reconnect if disconnected). Safe to call multiple times. */
  ensureConnected: () => Promise<boolean>;
  /** Run the full collect → process flow for a clientSecret obtained from /payments/intent. */
  chargeCard: (clientSecret: string) => Promise<{ success: true } | { success: false; error: string }>;
  /** Cancel an in-progress collectPaymentMethod, returning to ready state. */
  cancel: () => Promise<void>;
  reset: () => void;
}

export function useStripeTerminal(): UseStripeTerminal {
  const [stage, setStage] = useState<TerminalStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const terminalRef = useRef<AnyTerminal>(null);
  const initLockRef = useRef(false);

  const ensureConnected = useCallback(async (): Promise<boolean> => {
    if (terminalRef.current && stage !== 'error') {
      setStage('ready');
      return true;
    }

    if (initLockRef.current) return false;
    initLockRef.current = true;

    try {
      setStage('loading_sdk');
      setError(null);

      const { loadStripeTerminal } = await import('@stripe/terminal-js');
      const SDK = await loadStripeTerminal();
      if (!SDK) throw new Error('Failed to load Stripe Terminal SDK.');

      const terminal: AnyTerminal = SDK.create({
        onFetchConnectionToken: async () => {
          const res = await api.post<{ secret: string }>('/api/v1/payments/terminal/session', {});
          return res.secret;
        },
        onUnexpectedReaderDisconnect: () => {
          setStage('error');
          setError('Reader disconnected unexpectedly. Please reconnect.');
          terminalRef.current = null;
        },
      });

      setStage('discovering');
      const discoverResult = await terminal.discoverReaders({ simulated: true });
      if (discoverResult.error) throw new Error(discoverResult.error.message);
      if (!discoverResult.discoveredReaders?.length) throw new Error('No simulated readers found.');

      setStage('connecting');
      const connectResult = await terminal.connectReader(discoverResult.discoveredReaders[0]);
      if (connectResult.error) throw new Error(connectResult.error.message);

      terminalRef.current = terminal;
      setStage('ready');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Terminal initialization failed.';
      setStage('error');
      setError(msg);
      terminalRef.current = null;
      return false;
    } finally {
      initLockRef.current = false;
    }
  }, [stage]);

  const chargeCard = useCallback(
    async (clientSecret: string): Promise<{ success: true } | { success: false; error: string }> => {
      const terminal = terminalRef.current;
      if (!terminal) return { success: false, error: 'Reader not connected.' };

      setStage('collecting');
      setError(null);

      const collectResult = await terminal.collectPaymentMethod(clientSecret);
      if (collectResult.error) {
        const msg: string = collectResult.error.message ?? 'Card collection failed.';
        setStage('error');
        setError(msg);
        return { success: false, error: msg };
      }

      setStage('processing');
      const processResult = await terminal.processPayment(collectResult.paymentIntent);
      if (processResult.error) {
        const msg: string = processResult.error.message ?? 'Payment processing failed.';
        setStage('error');
        setError(msg);
        return { success: false, error: msg };
      }

      setStage('capturing');
      return { success: true };
    },
    [],
  );

  const cancel = useCallback(async () => {
    const terminal = terminalRef.current;
    if (terminal && stage === 'collecting') {
      await terminal.cancelCollectPaymentMethod().catch(() => null);
    }
    setStage(terminalRef.current ? 'ready' : 'idle');
    setError(null);
  }, [stage]);

  const reset = useCallback(() => {
    setStage(terminalRef.current ? 'ready' : 'idle');
    setError(null);
  }, []);

  return { stage, error, ensureConnected, chargeCard, cancel, reset };
}
