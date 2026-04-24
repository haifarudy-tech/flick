import { useEffect, useMemo, useState } from 'react';
import { T } from '@/tokens';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Pill } from '@/components/ui/Pill';
import { Toggle } from '@/components/ui/Toggle';
import { fmt, marginPct } from '@/lib/format';
import type { Category, MenuItem } from '@/types/menu';
import type { ItemPayload } from '@/hooks/useMenuMutations';

export interface MenuEditPanelProps {
  mode: 'create' | 'edit';
  item: MenuItem | null;
  categories: Category[];
  onClose: () => void;
  onSave: (payload: ItemPayload) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onDuplicate?: () => Promise<void> | void;
  saving: boolean;
}

interface FormState {
  name: string;
  emoji: string;
  description: string;
  categoryId: string;
  basePrice: string;
  costPrice: string;
  deliveryPriceUberEats: string;
  deliveryPriceDeliveroo: string;
  deliveryPriceJustEat: string;
  isAvailable: boolean;
  isPopular: boolean;
}

function blank(): FormState {
  return {
    name: '',
    emoji: '🍽',
    description: '',
    categoryId: '',
    basePrice: '',
    costPrice: '',
    deliveryPriceUberEats: '',
    deliveryPriceDeliveroo: '',
    deliveryPriceJustEat: '',
    isAvailable: true,
    isPopular: false,
  };
}

function fromItem(it: MenuItem): FormState {
  const n = (v: number | null | undefined) => (v == null ? '' : String(v));
  return {
    name: it.name,
    emoji: it.emoji ?? '',
    description: it.description ?? '',
    categoryId: it.categoryId ?? '',
    basePrice: String(it.basePrice),
    costPrice: n(it.costPrice),
    deliveryPriceUberEats: n(it.deliveryPriceUberEats),
    deliveryPriceDeliveroo: n(it.deliveryPriceDeliveroo),
    deliveryPriceJustEat: n(it.deliveryPriceJustEat),
    isAvailable: it.isAvailable,
    isPopular: it.isPopular,
  };
}

export function MenuEditPanel({
  mode,
  item,
  categories,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  saving,
}: MenuEditPanelProps) {
  const [form, setForm] = useState<FormState>(() =>
    item ? fromItem(item) : blank(),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm(item ? fromItem(item) : blank());
    setConfirmDelete(false);
  }, [item]);

  const price = Number(form.basePrice) || 0;
  const cost = Number(form.costPrice) || 0;
  const margin = useMemo(() => (price ? marginPct(price, cost) : 0), [price, cost]);

  const canSave = form.name.trim().length > 0 && price > 0 && !saving;

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!canSave) return;
    const payload: ItemPayload = {
      name: form.name.trim(),
      emoji: form.emoji.trim() || undefined,
      description: form.description.trim() || undefined,
      categoryId: form.categoryId || null,
      basePrice: Number(form.basePrice),
      costPrice: form.costPrice === '' ? 0 : Number(form.costPrice),
      isAvailable: form.isAvailable,
      isPopular: form.isPopular,
      deliveryPriceUberEats:
        form.deliveryPriceUberEats === '' ? 0 : Number(form.deliveryPriceUberEats),
      deliveryPriceDeliveroo:
        form.deliveryPriceDeliveroo === '' ? 0 : Number(form.deliveryPriceDeliveroo),
      deliveryPriceJustEat:
        form.deliveryPriceJustEat === '' ? 0 : Number(form.deliveryPriceJustEat),
    };
    await onSave(payload);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 100,
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxWidth: '100%',
          background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: T.textDim, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase' }}>
              {mode === 'create' ? 'Add new' : 'Edit'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>
              {mode === 'create' ? 'Menu item' : item?.name || 'Item'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: T.card,
              border: `1px solid ${T.border}`,
              color: T.textMid,
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => patch('name', e.target.value)}
                placeholder="Flat White"
                autoFocus
              />
            </div>
            <div style={{ width: 96 }}>
              <Label>Emoji</Label>
              <Input
                value={form.emoji}
                onChange={(e) => patch('emoji', e.target.value)}
                maxLength={4}
                style={{ textAlign: 'center', fontSize: 20, padding: '11px 8px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Label>Description</Label>
            <textarea
              value={form.description}
              onChange={(e) => patch('description', e.target.value)}
              rows={3}
              placeholder="Optional — shown on QR menu"
              style={{
                width: '100%',
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: '11px 12px',
                color: T.text,
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Label>Category</Label>
            <select
              value={form.categoryId}
              onChange={(e) => patch('categoryId', e.target.value)}
              style={{
                width: '100%',
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: '11px 12px',
                color: T.text,
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            >
              <option value="">— Uncategorised —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <Label>Price</Label>
              <Input
                leading="£"
                inputMode="decimal"
                value={form.basePrice}
                onChange={(e) => patch('basePrice', e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
              />
            </div>
            <div style={{ flex: 1 }}>
              <Label>Cost</Label>
              <Input
                leading="£"
                inputMode="decimal"
                value={form.costPrice}
                onChange={(e) => patch('costPrice', e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
              />
            </div>
            <div style={{ width: 96 }}>
              <Label>Margin</Label>
              <div
                style={{
                  height: 42,
                  borderRadius: 10,
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 800,
                  color: price && cost ? (margin > 65 ? T.green : margin > 40 ? T.gold : T.red) : T.textDim,
                }}
              >
                {price && cost ? `${margin}%` : '—'}
              </div>
            </div>
          </div>

          <div
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.7px',
                color: T.textMid,
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Delivery prices</span>
              <span style={{ color: T.textDim, fontWeight: 600, letterSpacing: 0, textTransform: 'none' }}>
                Override base for each platform
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { key: 'deliveryPriceUberEats', label: '🛵 Uber Eats', color: '#06C167' },
                { key: 'deliveryPriceDeliveroo', label: '🦘 Deliveroo', color: '#00CCBC' },
                { key: 'deliveryPriceJustEat', label: '🍔 Just Eat', color: '#FF8000' },
              ].map((p) => (
                <div key={p.key}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: p.color, marginBottom: 5 }}>
                    {p.label}
                  </div>
                  <Input
                    leading="£"
                    inputMode="decimal"
                    value={form[p.key as keyof FormState] as string}
                    onChange={(e) =>
                      patch(
                        p.key as keyof FormState,
                        e.target.value.replace(/[^0-9.]/g, '') as FormState[keyof FormState],
                      )
                    }
                    placeholder={price ? price.toFixed(2) : '0.00'}
                  />
                </div>
              ))}
            </div>
            {price > 0 && (
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 10, lineHeight: 1.5 }}>
                Base price: <strong style={{ color: T.text }}>{fmt(price)}</strong> — leave a
                platform blank to use it. Bump delivery prices to cover commission.
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              marginBottom: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Available</div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                Off means "86-ed" everywhere.
              </div>
            </div>
            <Toggle on={form.isAvailable} onChange={() => patch('isAvailable', !form.isAvailable)} />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Popular</div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                Shown with a star on the POS grid.
              </div>
            </div>
            <Toggle on={form.isPopular} onChange={() => patch('isPopular', !form.isPopular)} />
          </div>

          {mode === 'edit' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textDim, fontSize: 11 }}>
              <Pill color={T.textMid}>id</Pill>
              <code style={{ fontFamily: 'inherit' }}>{item?.id}</code>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 20px',
            borderTop: `1px solid ${T.border}`,
            display: 'flex',
            gap: 10,
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSave} style={{ flex: 2 }}>
              {saving ? 'Saving…' : mode === 'create' ? 'Create Item' : 'Save Changes'}
            </Button>
          </div>
          {mode === 'edit' && (
            <div style={{ display: 'flex', gap: 10 }}>
              {onDuplicate && (
                <Button variant="secondary" onClick={onDuplicate} style={{ flex: 1 }}>
                  Duplicate
                </Button>
              )}
              {onDelete &&
                (confirmDelete ? (
                  <Button variant="danger" onClick={onDelete} style={{ flex: 1 }}>
                    Confirm delete
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmDelete(true)}
                    style={{ flex: 1 }}
                  >
                    Delete
                  </Button>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
