import { useState, useEffect } from 'react';
import { T, RADIUS } from '@/tokens';
import { fmt } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import { useStaff, useTimesheet, useCreateStaff, useUpdateStaff, useClockIn, useClockOut, useStaffSocket } from '@/hooks/useStaff';
import type { StaffMember, TimesheetEntry } from '@/types/staff';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  OWNER: T.purple,
  MANAGER: T.blue,
  CASHIER: T.accent,
  KITCHEN: T.gold,
};

const ROLES = ['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN'] as const;

function todayStr() {
  return new Date().toISOString().split('T')[0]!;
}

function fmtHours(h: number) {
  return `${h.toFixed(1)}h`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ initials, size = 40, clockedIn = false }: { initials: string; size?: number; clockedIn?: boolean }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${T.surface}, ${T.card})`,
          border: `2px solid ${clockedIn ? T.green : T.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.35,
          fontWeight: 800,
          color: T.text,
        }}
      >
        {initials}
      </div>
      {clockedIn && (
        <div
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: T.green,
            border: `2px solid ${T.bg}`,
          }}
        />
      )}
    </div>
  );
}

// ─── Add Staff Modal ──────────────────────────────────────────────────────────

interface AddStaffFormState {
  name: string;
  email: string;
  password: string;
  role: string;
  pin: string;
  hourlyRate: string;
}

function AddStaffModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const createStaff = useCreateStaff();
  const [form, setForm] = useState<AddStaffFormState>({
    name: '',
    email: '',
    password: '',
    role: 'CASHIER',
    pin: '',
    hourlyRate: '',
  });
  const [showPin, setShowPin] = useState(false);

  const set = (k: keyof AddStaffFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createStaff.mutateAsync({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        pin: form.pin || undefined,
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
      });
      toast.success(`${form.name} added`);
      if (form.pin) setShowPin(true);
      else onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create staff member';
      toast.error(msg);
    }
  };

  if (showPin) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 8 }}>
            PIN Set for {form.name}
          </div>
          <div style={{ fontSize: 12, color: T.textMid, marginBottom: 16 }}>
            Share this PIN once — it won't be shown again
          </div>
          <div
            style={{
              background: T.surface,
              border: `1px solid ${T.accent}50`,
              borderRadius: RADIUS.md,
              padding: '16px 32px',
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: '0.4em',
              color: T.accent,
              fontFamily: 'monospace',
              marginBottom: 20,
            }}
          >
            {form.pin}
          </div>
          <button
            onClick={onClose}
            style={{ padding: '10px 28px', borderRadius: RADIUS.sm, background: T.accent, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
          >
            Done
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 4 }}>Add Staff Member</div>
        {[
          { label: 'Full Name', key: 'name' as const, type: 'text', placeholder: 'Jane Smith', required: true },
          { label: 'Email', key: 'email' as const, type: 'email', placeholder: 'jane@example.com', required: true },
          { label: 'Password', key: 'password' as const, type: 'password', placeholder: 'Min 8 characters', required: true },
          { label: '4-digit PIN (optional)', key: 'pin' as const, type: 'text', placeholder: '••••', required: false, maxLength: 4 },
          { label: 'Hourly Rate (£)', key: 'hourlyRate' as const, type: 'number', placeholder: '12.00', required: false },
        ].map((f) => (
          <div key={f.key}>
            <label style={{ fontSize: 11, color: T.textMid, fontWeight: 700, display: 'block', marginBottom: 5 }}>
              {f.label}
            </label>
            <input
              type={f.type}
              value={form[f.key]}
              onChange={set(f.key)}
              placeholder={f.placeholder}
              required={f.required}
              maxLength={f.maxLength}
              pattern={f.key === 'pin' ? '\\d{4}' : undefined}
              style={fieldStyle}
            />
          </div>
        ))}
        <div>
          <label style={{ fontSize: 11, color: T.textMid, fontWeight: 700, display: 'block', marginBottom: 5 }}>Role</label>
          <select value={form.role} onChange={set('role')} style={fieldStyle}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
          <button type="submit" disabled={createStaff.isPending} style={{ ...btnPrimary, flex: 1 }}>
            {createStaff.isPending ? 'Adding…' : 'Add Staff'}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

// ─── Edit Staff Panel ─────────────────────────────────────────────────────────

function EditStaffPanel({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const toast = useToast();
  const updateStaff = useUpdateStaff();
  const [form, setForm] = useState({
    name: member.name,
    role: member.role,
    hourlyRate: String(member.staff?.hourlyRate ?? 0),
    pin: '',
    isActive: member.isActive,
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
  };

  const handleSave = async () => {
    try {
      await updateStaff.mutateAsync({
        id: member.id,
        name: form.name,
        role: form.role,
        hourlyRate: parseFloat(form.hourlyRate) || 0,
        ...(form.pin ? { pin: form.pin } : {}),
        isActive: form.isActive,
      });
      toast.success('Staff updated');
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleDeactivate = async () => {
    if (!confirm(`Deactivate ${member.name}? They won't be able to log in.`)) return;
    try {
      await updateStaff.mutateAsync({ id: member.id, isActive: false });
      toast.success(`${member.name} deactivated`);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: 340,
          background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Avatar initials={member.avatarInitials} clockedIn={member.staff?.clockedIn} />
          <div>
            <div style={{ fontWeight: 800, color: T.text }}>{member.name}</div>
            <div style={{ fontSize: 11, color: ROLE_COLORS[member.role] ?? T.textMid, fontWeight: 700, textTransform: 'uppercase' }}>
              {member.role}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <FieldGroup label="Full Name">
          <input type="text" value={form.name} onChange={set('name')} style={fieldStyle} />
        </FieldGroup>
        <FieldGroup label="Role">
          <select value={form.role} onChange={set('role')} style={fieldStyle}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </FieldGroup>
        <FieldGroup label="Hourly Rate (£)">
          <input type="number" value={form.hourlyRate} onChange={set('hourlyRate')} min="0" step="0.01" style={fieldStyle} />
        </FieldGroup>
        <FieldGroup label="Reset PIN (4 digits)">
          <input type="text" value={form.pin} onChange={set('pin')} placeholder="Leave blank to keep current" maxLength={4} pattern="\d{4}" style={fieldStyle} />
        </FieldGroup>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: T.text }}>
          <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
          Active (can log in)
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <button onClick={handleSave} disabled={updateStaff.isPending} style={btnPrimary}>
            {updateStaff.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          {member.isActive && (
            <button onClick={handleDeactivate} style={btnDanger}>
              Deactivate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Staff Card ───────────────────────────────────────────────────────────────

function StaffCard({
  member,
  onEdit,
}: {
  member: StaffMember;
  onEdit: () => void;
}) {
  const toast = useToast();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const clockedIn = member.staff?.clockedIn ?? false;

  const handleClock = async () => {
    try {
      if (clockedIn) {
        await clockOut.mutateAsync(member.id);
        toast.success(`${member.name} clocked out`);
      } else {
        await clockIn.mutateAsync(member.id);
        toast.success(`${member.name} clocked in`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Clock action failed');
    }
  };

  const loading = clockIn.isPending || clockOut.isPending;

  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${clockedIn ? `${T.green}40` : T.border}`,
        borderRadius: RADIUS.card,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'default',
        opacity: member.isActive ? 1 : 0.5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Avatar initials={member.avatarInitials} size={44} clockedIn={clockedIn} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontWeight: 700, fontSize: 14, color: T.text, cursor: 'pointer' }}
            onClick={onEdit}
          >
            {member.name}
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: ROLE_COLORS[member.role] ?? T.textMid,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
            }}
          >
            {member.role}
          </div>
        </div>
        {!member.isActive && (
          <span style={{ fontSize: 10, color: T.textDim, background: T.surface, borderRadius: 4, padding: '2px 6px', border: `1px solid ${T.border}` }}>
            INACTIVE
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <StatPill label="Hours" value={fmtHours(member.todayHours)} color={T.text} />
        <StatPill label="Sales" value={fmt(member.todaySales)} color={T.accent} />
        <StatPill label="Tips" value={fmt(member.todayTips)} color={T.gold} />
      </div>

      {member.isActive && (
        <button
          onClick={handleClock}
          disabled={loading}
          style={{
            width: '100%',
            padding: '7px 0',
            borderRadius: RADIUS.sm,
            border: `1px solid ${clockedIn ? T.red + '60' : T.green + '60'}`,
            background: clockedIn ? `${T.red}10` : `${T.green}10`,
            color: clockedIn ? T.red : T.green,
            fontSize: 12,
            fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '…' : clockedIn ? 'Clock Out' : 'Clock In'}
        </button>
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, background: T.surface, borderRadius: RADIUS.sm, padding: '6px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: T.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ─── Timesheet Table ──────────────────────────────────────────────────────────

function TimesheetTable({ rows }: { rows: TimesheetEntry[] }) {
  if (rows.length === 0) {
    return <div style={{ color: T.textDim, fontSize: 13, padding: '12px 0' }}>No clock activity today</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Staff', 'Role', 'Clock In', 'Clock Out', 'Hours', 'Sales', 'Tips', 'Labour'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: h === 'Staff' || h === 'Role' ? 'left' : 'right',
                  color: T.textDim,
                  fontWeight: 700,
                  padding: '0 10px 10px',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const latestShift = row.shifts[row.shifts.length - 1];
            return (
              <tr key={row.userId}>
                <td style={{ padding: '10px 10px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar initials={row.avatarInitials} size={28} clockedIn={row.clockedIn} />
                    <span style={{ fontWeight: 600, color: T.text }}>{row.userName}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 10px', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ROLE_COLORS[row.role] ?? T.textMid, textTransform: 'uppercase' }}>
                    {row.role}
                  </span>
                </td>
                <td style={{ textAlign: 'right', padding: '10px 10px', color: T.text, borderBottom: `1px solid ${T.border}` }}>
                  {latestShift ? fmtTime(latestShift.clockIn) : '—'}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 10px', borderBottom: `1px solid ${T.border}` }}>
                  {latestShift?.clockOut ? (
                    fmtTime(latestShift.clockOut)
                  ) : row.clockedIn ? (
                    <span style={{ color: T.green, fontWeight: 600 }}>IN</span>
                  ) : '—'}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 10px', color: T.text, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>
                  {fmtHours(row.totalHours)}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 10px', color: T.accent, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>
                  {fmt(row.todaySales)}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 10px', color: T.gold, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>
                  {fmt(row.todayTips)}
                </td>
                <td style={{ textAlign: 'right', padding: '10px 10px', color: T.text, borderBottom: `1px solid ${T.border}` }}>
                  {fmt(row.labourCost)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={{ padding: '10px 10px', fontWeight: 700, color: T.textMid, fontSize: 11 }}>TOTALS</td>
            <td style={{ textAlign: 'right', padding: '10px 10px', fontWeight: 700, color: T.text }}>
              {fmtHours(rows.reduce((s, r) => s + r.totalHours, 0))}
            </td>
            <td style={{ textAlign: 'right', padding: '10px 10px', fontWeight: 700, color: T.accent }}>
              {fmt(rows.reduce((s, r) => s + r.todaySales, 0))}
            </td>
            <td style={{ textAlign: 'right', padding: '10px 10px', fontWeight: 700, color: T.gold }}>
              {fmt(rows.reduce((s, r) => s + r.todayTips, 0))}
            </td>
            <td style={{ textAlign: 'right', padding: '10px 10px', fontWeight: 700, color: T.text }}>
              {fmt(rows.reduce((s, r) => s + r.labourCost, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function StaffPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);

  const { data: staffData, isLoading, error } = useStaff();
  const { data: timesheetData } = useTimesheet(todayStr());

  useStaffSocket();

  const staff = staffData?.staff ?? [];
  const timesheetRows = (timesheetData?.rows ?? []).filter((r) => r.shifts.length > 0 || r.clockedIn);
  const clockedInCount = staff.filter((s) => s.staff?.clockedIn).length;

  if (error) {
    const isUnauthorized = error instanceof Error && error.message.includes('403');
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: T.textMid, gap: 8 }}>
        <div style={{ fontSize: 28, opacity: 0.3 }}>◉</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>
          {isUnauthorized ? 'Pro Plan Required' : 'Error loading staff'}
        </div>
        <div style={{ fontSize: 12 }}>
          {isUnauthorized ? 'Staff management is available on the Pro plan.' : error.message}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.bg, color: T.text }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Staff</div>
          {!isLoading && (
            <div style={{ fontSize: 12, color: T.textMid, marginTop: 2 }}>
              <span style={{ color: T.green, fontWeight: 700 }}>{clockedInCount} clocked in</span>
              {' · '}
              {staff.filter((s) => s.isActive).length - clockedInCount} clocked out
              {' · '}
              {staff.filter((s) => !s.isActive).length} inactive
            </div>
          )}
        </div>
        <a
          href="/staff/clock"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '7px 14px',
            borderRadius: RADIUS.sm,
            border: `1px solid ${T.border}`,
            background: T.surface,
            color: T.textMid,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          ⏱ Clock Widget
        </a>
        <button
          onClick={() => setShowAdd(true)}
          style={btnPrimary}
        >
          + Add Staff
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Staff grid */}
        {isLoading ? (
          <div style={{ color: T.textDim, fontSize: 13 }}>Loading staff…</div>
        ) : staff.length === 0 ? (
          <div style={{ color: T.textDim, fontSize: 13 }}>No staff members yet. Add your first team member.</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {staff.map((member) => (
              <StaffCard
                key={member.id}
                member={member}
                onEdit={() => setEditingMember(member)}
              />
            ))}
          </div>
        )}

        {/* Timesheet */}
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: RADIUS.card,
            padding: '20px 24px',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>
            Today's Timesheet — {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <TimesheetTable rows={timesheetRows} />
        </div>
      </div>

      {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} />}
      {editingMember && <EditStaffPanel member={editingMember} onClose={() => setEditingMember(null)} />}
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Close on backdrop click
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: RADIUS.card,
          padding: 28,
          width: '100%',
          maxWidth: 420,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: T.textMid, fontWeight: 700, display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: RADIUS.sm,
  border: `1px solid ${T.border}`,
  background: T.card,
  color: T.text,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  padding: '9px 20px',
  borderRadius: RADIUS.sm,
  background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
  color: '#fff',
  border: 'none',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '9px 20px',
  borderRadius: RADIUS.sm,
  background: T.card,
  color: T.textMid,
  border: `1px solid ${T.border}`,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  padding: '9px 20px',
  borderRadius: RADIUS.sm,
  background: `${T.red}15`,
  color: T.red,
  border: `1px solid ${T.red}40`,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};
