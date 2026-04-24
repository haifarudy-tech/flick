import { useState } from 'react';
import { T } from '@/tokens';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import type { Category } from '@/types/menu';

export interface CategoryManagerProps {
  categories: Category[];
  onClose: () => void;
  onCreate: (name: string) => Promise<void> | void;
  onRename: (id: string, name: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onReorder: (ids: string[]) => Promise<void> | void;
  saving: boolean;
}

export function CategoryManager({
  categories,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onReorder,
  saving,
}: CategoryManagerProps) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const move = (id: string, dir: -1 | 1) => {
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    const next = sorted.slice();
    const a = next[idx];
    const b = next[target];
    if (!a || !b) return;
    next[idx] = b;
    next[target] = a;
    void onReorder(next.map((c) => c.id));
  };

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await onCreate(name);
    setNewName('');
  };

  const submitRename = async () => {
    if (!editing) return;
    const name = editing.value.trim();
    if (!name) {
      setEditing(null);
      return;
    }
    await onRename(editing.id, name);
    setEditing(null);
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
          width: 420,
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
            <div
              style={{
                fontSize: 11,
                color: T.textDim,
                fontWeight: 700,
                letterSpacing: '0.7px',
                textTransform: 'uppercase',
              }}
            >
              Manage
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>Categories</div>
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
          <Label>Add new</Label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Breakfast"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitCreate();
              }}
            />
            <Button onClick={submitCreate} disabled={saving || !newName.trim()}>
              Add
            </Button>
          </div>

          <Label>Existing</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.length === 0 && (
              <div
                style={{
                  border: `1px dashed ${T.border}`,
                  borderRadius: 12,
                  padding: 18,
                  textAlign: 'center',
                  color: T.textDim,
                  fontSize: 13,
                }}
              >
                No categories yet — add one above.
              </div>
            )}
            {sorted.map((c, i) => {
              const isEditing = editing?.id === c.id;
              const isConfirming = confirmDelete === c.id;
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button
                      onClick={() => move(c.id, -1)}
                      disabled={i === 0}
                      title="Move up"
                      style={{
                        width: 22,
                        height: 16,
                        border: 'none',
                        background: 'transparent',
                        color: i === 0 ? T.textDim : T.textMid,
                        cursor: i === 0 ? 'not-allowed' : 'pointer',
                        fontSize: 10,
                      }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(c.id, 1)}
                      disabled={i === sorted.length - 1}
                      title="Move down"
                      style={{
                        width: 22,
                        height: 16,
                        border: 'none',
                        background: 'transparent',
                        color: i === sorted.length - 1 ? T.textDim : T.textMid,
                        cursor: i === sorted.length - 1 ? 'not-allowed' : 'pointer',
                        fontSize: 10,
                      }}
                    >
                      ▼
                    </button>
                  </div>

                  {isEditing ? (
                    <Input
                      autoFocus
                      value={editing.value}
                      onChange={(e) => setEditing({ id: c.id, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void submitRename();
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      onBlur={submitRename}
                    />
                  ) : (
                    <div
                      onClick={() => setEditing({ id: c.id, value: c.name })}
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'text',
                        padding: '6px 4px',
                      }}
                    >
                      {c.name}
                    </div>
                  )}

                  {isConfirming ? (
                    <Button
                      small
                      variant="danger"
                      onClick={async () => {
                        await onDelete(c.id);
                        setConfirmDelete(null);
                      }}
                    >
                      Confirm
                    </Button>
                  ) : (
                    <Button
                      small
                      variant="ghost"
                      onClick={() => setConfirmDelete(c.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 20,
              padding: 12,
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              fontSize: 11,
              color: T.textDim,
              lineHeight: 1.6,
            }}
          >
            Deleting a category leaves its items uncategorised — they won't be lost.
            Click a name to rename it.
          </div>
        </div>
      </div>
    </div>
  );
}
