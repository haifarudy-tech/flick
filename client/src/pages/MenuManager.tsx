import { useMemo, useState } from 'react';
import { T } from '@/tokens';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pill } from '@/components/ui/Pill';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useMenu } from '@/hooks/useMenu';
import { useAuthStore } from '@/stores/auth';
import { useNavigate } from 'react-router-dom';
import {
  useCreateItem,
  useDeleteItem,
  useToggleAvailability,
  useUpdateItem,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/hooks/useMenuMutations';
import { fmt, marginPct } from '@/lib/format';
import { ApiError } from '@/lib/api';
import type { Category, MenuItem } from '@/types/menu';
import { MenuEditPanel } from '@/components/menu/MenuEditPanel';
import { CategoryManager } from '@/components/menu/CategoryManager';

type PanelState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; item: MenuItem }
  | { kind: 'categories' };

export function MenuManagerPage() {
  const { data, isLoading } = useMenu();
  const toast = useToast();
  const plan = useAuthStore((s) => s.business?.plan ?? 'FREE');
  const navBilling = useNavigate();

  const categories = data?.categories ?? [];
  const items = data?.items ?? [];
  const itemCount = items.length;
  const isFree = plan === 'FREE';
  const nearLimit = isFree && itemCount >= 40;
  const atLimit = isFree && itemCount >= 50;

  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const toggleAvailability = useToggleAvailability();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [panel, setPanel] = useState<PanelState>({ kind: 'none' });
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [dragId, setDragId] = useState<string | null>(null);

  const anyMutating =
    createItem.isPending ||
    updateItem.isPending ||
    deleteItem.isPending ||
    toggleAvailability.isPending ||
    createCategory.isPending ||
    updateCategory.isPending ||
    deleteCategory.isPending;

  // Apply filter + live search. Keep sortOrder within each category.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((it) => (filterCat === 'all' ? true : (it.categoryId ?? '') === filterCat))
      .filter((it) => (q ? it.name.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        const ca = categories.find((c) => c.id === a.categoryId)?.sortOrder ?? 999;
        const cb = categories.find((c) => c.id === b.categoryId)?.sortOrder ?? 999;
        if (ca !== cb) return ca - cb;
        return a.sortOrder - b.sortOrder;
      });
  }, [items, categories, filterCat, search]);

  const unavailableCount = items.filter((i) => !i.isAvailable).length;

  const toastError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) toast.error(err.message);
    else if (err instanceof Error) toast.error(err.message);
    else toast.error(fallback);
  };

  const onToggle = async (item: MenuItem) => {
    try {
      await toggleAvailability.mutateAsync({
        id: item.id,
        isAvailable: !item.isAvailable,
      });
      toast.success(
        !item.isAvailable
          ? `${item.name} is now available`
          : `${item.name} is 86-ed everywhere`,
      );
    } catch (err) {
      toastError(err, 'Could not toggle availability');
    }
  };

  const save = async (payload: Parameters<typeof createItem.mutateAsync>[0]) => {
    if (panel.kind === 'create') {
      try {
        const maxSort = items.reduce((m, i) => Math.max(m, i.sortOrder), 0);
        await createItem.mutateAsync({ ...payload, sortOrder: maxSort + 1 });
        toast.success(`${payload.name} added`);
        setPanel({ kind: 'none' });
      } catch (err) {
        toastError(err, 'Could not create item');
      }
    } else if (panel.kind === 'edit') {
      try {
        await updateItem.mutateAsync({ id: panel.item.id, payload });
        toast.success(`${payload.name ?? panel.item.name} saved`);
        setPanel({ kind: 'none' });
      } catch (err) {
        toastError(err, 'Could not save item');
      }
    }
  };

  const remove = async () => {
    if (panel.kind !== 'edit') return;
    try {
      await deleteItem.mutateAsync(panel.item.id);
      toast.success(`${panel.item.name} deleted`);
      setPanel({ kind: 'none' });
    } catch (err) {
      toastError(err, 'Could not delete item');
    }
  };

  const duplicate = async () => {
    if (panel.kind !== 'edit') return;
    const src = panel.item;
    try {
      const created = await createItem.mutateAsync({
        name: `${src.name} (copy)`,
        emoji: src.emoji ?? undefined,
        description: src.description ?? undefined,
        categoryId: src.categoryId,
        basePrice: src.basePrice,
        costPrice: src.costPrice ?? 0,
        isAvailable: src.isAvailable,
        isPopular: false,
        deliveryPriceUberEats: src.deliveryPriceUberEats ?? 0,
        deliveryPriceDeliveroo: src.deliveryPriceDeliveroo ?? 0,
        deliveryPriceJustEat: src.deliveryPriceJustEat ?? 0,
        sortOrder: src.sortOrder + 1,
      });
      toast.success(`Duplicated as "${created.name}"`);
      setPanel({ kind: 'none' });
    } catch (err) {
      toastError(err, 'Could not duplicate');
    }
  };

  const catCreate = async (name: string) => {
    const maxSort = categories.reduce((m, c) => Math.max(m, c.sortOrder), 0);
    try {
      await createCategory.mutateAsync({ name, sortOrder: maxSort + 1 });
      toast.success(`${name} added`);
    } catch (err) {
      toastError(err, 'Could not add category');
    }
  };
  const catRename = async (id: string, name: string) => {
    try {
      await updateCategory.mutateAsync({ id, payload: { name } });
      toast.success('Renamed');
    } catch (err) {
      toastError(err, 'Could not rename');
    }
  };
  const catDelete = async (id: string) => {
    try {
      await deleteCategory.mutateAsync(id);
      toast.success('Deleted');
    } catch (err) {
      toastError(err, 'Could not delete category');
    }
  };
  const catReorder = async (ids: string[]) => {
    try {
      await Promise.all(
        ids.map((id, i) =>
          updateCategory.mutateAsync({ id, payload: { sortOrder: i + 1 } }),
        ),
      );
    } catch (err) {
      toastError(err, 'Could not reorder');
    }
  };

  // Within-category drag reorder. Drops are only meaningful if both items
  // share a category — cross-category reparenting goes through the edit panel.
  const onDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const src = items.find((i) => i.id === dragId);
    const tgt = items.find((i) => i.id === targetId);
    setDragId(null);
    if (!src || !tgt) return;
    if ((src.categoryId ?? '') !== (tgt.categoryId ?? '')) return;
    const sameCat = items
      .filter((i) => (i.categoryId ?? '') === (src.categoryId ?? ''))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const withoutSrc = sameCat.filter((i) => i.id !== src.id);
    const tgtIdx = withoutSrc.findIndex((i) => i.id === tgt.id);
    withoutSrc.splice(tgtIdx, 0, src);
    try {
      await Promise.all(
        withoutSrc.map((it, i) =>
          updateItem.mutateAsync({ id: it.id, payload: { sortOrder: i + 1 } }),
        ),
      );
    } catch (err) {
      toastError(err, 'Could not reorder');
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${T.border}`,
          background: T.surface,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Menu Management</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: T.textDim }}>
            {items.length} items · {unavailableCount} unavailable · {categories.length} categories
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => setPanel({ kind: 'categories' })}>
            Manage categories
          </Button>
          <Button onClick={() => setPanel({ kind: 'create' })} icon="+" disabled={atLimit}>
            {atLimit ? 'Limit reached' : 'Add item'}
          </Button>
        </div>
      </div>

      {/* FREE plan item limit warning */}
      {nearLimit && (
        <div
          style={{
            padding: '10px 20px',
            background: atLimit ? `${T.red}10` : `${T.gold}10`,
            borderBottom: `1px solid ${atLimit ? `${T.red}25` : `${T.gold}25`}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: atLimit ? T.red : T.gold }}>
            {atLimit
              ? `⚠ You've reached the 50-item limit on the Free plan. No new items can be added.`
              : itemCount >= 49
              ? `⚠ 1 item remaining on your Free plan limit (${itemCount}/50).`
              : itemCount >= 45
              ? `You're at ${itemCount}/50 items on the Free plan.`
              : `Approaching your 50-item free limit (${itemCount}/50).`}
          </span>
          <button
            onClick={() => navBilling('/settings/billing')}
            style={{
              background: 'transparent',
              border: `1px solid ${atLimit ? T.red : T.gold}`,
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              color: atLimit ? T.red : T.gold,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            Upgrade
          </button>
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: `1px solid ${T.border}`,
          background: T.bg,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ width: 260 }}>
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leading="⌕"
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          <CatChip
            active={filterCat === 'all'}
            label={`All · ${items.length}`}
            onClick={() => setFilterCat('all')}
          />
          {categories.map((c) => {
            const count = items.filter((i) => i.categoryId === c.id).length;
            return (
              <CatChip
                key={c.id}
                active={filterCat === c.id}
                label={`${c.name} · ${count}`}
                onClick={() => setFilterCat(c.id)}
              />
            );
          })}
          {items.some((i) => !i.categoryId) && (
            <CatChip
              active={filterCat === ''}
              label={`Uncategorised · ${items.filter((i) => !i.categoryId).length}`}
              onClick={() => setFilterCat('')}
            />
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && (
          <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>
            Loading menu…
          </div>
        )}
        {!isLoading && visible.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: T.textDim, fontSize: 13 }}>
            {items.length === 0
              ? "You don't have any menu items yet. Click Add item to create your first one."
              : 'No items match those filters.'}
          </div>
        )}
        {!isLoading && visible.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.surface, position: 'sticky', top: 0, zIndex: 1 }}>
                {['', 'Item', 'Category', 'Price', 'Cost', 'Margin', 'Stock', ''].map(
                  (h) => (
                    <th
                      key={h || Math.random()}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: 10,
                        color: T.textDim,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.7px',
                        borderBottom: `1px solid ${T.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  categories={categories}
                  onEdit={() => setPanel({ kind: 'edit', item })}
                  onToggle={() => onToggle(item)}
                  toggling={
                    toggleAvailability.isPending &&
                    toggleAvailability.variables?.id === item.id
                  }
                  onDragStart={() => setDragId(item.id)}
                  onDragEnd={() => setDragId(null)}
                  onDropRow={() => onDrop(item.id)}
                  isDragging={dragId === item.id}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Panels */}
      {panel.kind === 'create' && (
        <MenuEditPanel
          mode="create"
          item={null}
          categories={categories}
          onClose={() => setPanel({ kind: 'none' })}
          onSave={save}
          saving={createItem.isPending}
        />
      )}
      {panel.kind === 'edit' && (
        <MenuEditPanel
          mode="edit"
          item={panel.item}
          categories={categories}
          onClose={() => setPanel({ kind: 'none' })}
          onSave={save}
          onDelete={remove}
          onDuplicate={duplicate}
          saving={updateItem.isPending || deleteItem.isPending || createItem.isPending}
        />
      )}
      {panel.kind === 'categories' && (
        <CategoryManager
          categories={categories}
          onClose={() => setPanel({ kind: 'none' })}
          onCreate={catCreate}
          onRename={catRename}
          onDelete={catDelete}
          onReorder={catReorder}
          saving={anyMutating}
        />
      )}
    </div>
  );
}

function CatChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 9,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 700,
        border: active ? `1px solid ${T.accent}50` : `1px solid ${T.border}`,
        background: active ? T.accentGlow : 'transparent',
        color: active ? T.accent : T.textMid,
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

function Row({
  item,
  categories,
  onEdit,
  onToggle,
  toggling,
  onDragStart,
  onDragEnd,
  onDropRow,
  isDragging,
}: {
  item: MenuItem;
  categories: Category[];
  onEdit: () => void;
  onToggle: () => void;
  toggling: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropRow: () => void;
  isDragging: boolean;
}) {
  const margin = marginPct(item.basePrice, item.costPrice);
  const cat = categories.find((c) => c.id === item.categoryId);
  const hasCost = item.costPrice != null && item.costPrice > 0;
  return (
    <tr
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDropRow();
      }}
      style={{
        borderBottom: `1px solid ${T.border}40`,
        opacity: isDragging ? 0.4 : item.isAvailable ? 1 : 0.55,
        background: isDragging ? T.cardHover : 'transparent',
        cursor: 'grab',
      }}
    >
      <td style={{ padding: '12px 4px 12px 16px', width: 22, color: T.textDim, fontSize: 14 }}>
        ⋮⋮
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{item.emoji ?? '🍽'}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: item.isAvailable ? T.text : T.textMid }}>
              {item.name}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
              {item.isPopular && (
                <span style={{ fontSize: 9, color: T.accent, fontWeight: 800 }}>★ POPULAR</span>
              )}
              {!item.isAvailable && (
                <span style={{ fontSize: 9, color: T.red, fontWeight: 800 }}>86-ED</span>
              )}
              {item.description && (
                <span
                  style={{
                    fontSize: 11,
                    color: T.textDim,
                    maxWidth: 280,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.description}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: '12px 16px' }}>
        {cat ? (
          <Pill color={T.blue}>{cat.name}</Pill>
        ) : (
          <span style={{ fontSize: 11, color: T.textDim }}>—</span>
        )}
      </td>
      <td style={{ padding: '12px 16px', fontWeight: 800, color: T.accent }}>
        {fmt(item.basePrice)}
      </td>
      <td style={{ padding: '12px 16px', color: T.textMid }}>
        {hasCost ? fmt(item.costPrice as number) : <span style={{ color: T.textDim }}>—</span>}
      </td>
      <td style={{ padding: '12px 16px' }}>
        {hasCost ? (
          <Pill color={margin > 65 ? T.green : margin > 40 ? T.gold : T.red}>{margin}%</Pill>
        ) : (
          <span style={{ fontSize: 11, color: T.textDim }}>—</span>
        )}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ opacity: toggling ? 0.5 : 1 }}>
          <Toggle on={item.isAvailable} onChange={onToggle} />
        </div>
      </td>
      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
        <Button small variant="secondary" onClick={onEdit}>
          Edit
        </Button>
      </td>
    </tr>
  );
}
