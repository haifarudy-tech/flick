import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { App } from './App';
import { QueryProvider } from './lib/queryClient';
import { bootstrapSession } from './lib/api';
import { wireSocketToAuth } from './lib/socket';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSentry } from './lib/sentry';

initSentry();

// Wire the socket to auth-state changes so token refresh rebuilds the
// connection automatically.
wireSocketToAuth();

// Attempt a silent refresh from the httpOnly cookie before first paint.
// The resulting `status` is read by ProtectedRoute to gate navigation.
void bootstrapSession();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </QueryProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
