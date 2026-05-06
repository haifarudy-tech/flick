import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/AppShell';
import { LoginPage } from '@/pages/Login';
import { SignupPage } from '@/pages/Signup';
import { PosLoginPage } from '@/pages/PosLogin';
import { PosPage } from '@/pages/Pos';
import { MenuManagerPage } from '@/pages/MenuManager';
import { OrdersPage } from '@/pages/Orders';
import { KitchenPage } from '@/pages/Kitchen';
import { DeliveryPage } from '@/pages/Delivery';
import { DeliveryCallbackPage } from '@/pages/DeliveryCallback';
import { SettingsPaymentsPage } from '@/pages/SettingsPayments';
import { SettingsBillingPage } from '@/pages/SettingsBilling';
import { AnalyticsPage } from '@/pages/Analytics';
import { StaffPage } from '@/pages/Staff';
import { StaffClockPage } from '@/pages/StaffClock';
import { OnboardingPage } from '@/pages/Onboarding';
import { PublicMenuPage } from '@/pages/PublicMenu';
import { PublicMenuConfirmationPage } from '@/pages/PublicMenuConfirmation';
import { QRSettingsPage } from '@/pages/QRSettings';
import { T } from '@/tokens';

// Placeholder screens for routes that land in later sessions.
function Soon({ title, session }: { title: string; session: number }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: T.textMid,
        gap: 8,
      }}
    >
      <div style={{ fontSize: 30, opacity: 0.25 }}>⊞</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{title}</div>
      <div style={{ fontSize: 12 }}>Arrives in session {session}.</div>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      {/* ── Public (no auth, no sidebar) ─────────────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/pos-login" element={<PosLoginPage />} />
      <Route path="/staff/clock" element={<StaffClockPage />} />

      {/* ── Public QR menu ───────────────────────────────────────────────── */}
      <Route path="/menu/:slug" element={<PublicMenuPage />} />
      <Route
        path="/menu/:slug/order/:orderId/confirmation"
        element={<PublicMenuConfirmationPage />}
      />

      {/* ── Protected (shared AppShell) ───────────────────────────────────── */}
      <Route
        path="/pos"
        element={
          <ProtectedRoute>
            <AppShell>
              <PosPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <AppShell>
              <OrdersPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/kitchen"
        element={
          <ProtectedRoute>
            <AppShell>
              <KitchenPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/delivery"
        element={
          <ProtectedRoute>
            <AppShell>
              <DeliveryPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AppShell>
              <AnalyticsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/menu-manager"
        element={
          <ProtectedRoute>
            <AppShell>
              <MenuManagerPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff"
        element={
          <ProtectedRoute>
            <AppShell>
              <StaffPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppShell>
              <SettingsBillingPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/billing"
        element={
          <ProtectedRoute>
            <AppShell>
              <SettingsBillingPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/payments"
        element={
          <ProtectedRoute>
            <AppShell>
              <SettingsPaymentsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/qr"
        element={
          <ProtectedRoute>
            <AppShell>
              <QRSettingsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/delivery/callback/:platform"
        element={
          <ProtectedRoute>
            <AppShell>
              <DeliveryCallbackPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Onboarding — protected but no AppShell (full-page wizard) */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/pos" replace />} />
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}
