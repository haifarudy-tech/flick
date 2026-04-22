import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { T } from '@/tokens';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { accessToken, status } = useAuthStore();
  const location = useLocation();

  // Show a minimal splash while the boot refresh is still in flight.
  if (status === 'idle' || status === 'refreshing') {
    return (
      <div
        style={{
          height: '100vh',
          background: T.bg,
          color: T.textMid,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
        }}
      >
        Loading…
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
