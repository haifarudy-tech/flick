import { T } from '@/tokens';
import { useCartStore } from '@/stores/cart';
import { Button } from '@/components/ui/Button';

// Slide-out panel listing held orders. Tapping a held order moves it back
// into the active cart; the trash icon deletes the held order.

export function HoldsPanel({ onClose }: { onClose: () => void }) {
  const held = useCartStore((s) => s.held);
  const recall = useCartStore((s) => s.recall);
  const deleteHeld = useCartStore((s) => s.deleteHeld);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(12,11,9,0.6)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 360,
          height: '100%',
          background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Held orders</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
              {held.length} order{held.length !== 1 ? 's' : ''}
            </div>
          </div>
          <Button variant="secondary" small onClick={onClose}>
            Close
          </Button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {held.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: T.textDim,
                gap: 8,
                textAlign: 'center',
                padding: 20,
              }}
            >
              <div style={{ fontSize: 36, opacity: 0.2 }}>◫</div>
              <div style={{ fontSize: 13 }}>No held orders</div>
              <div style={{ fontSize: 11 }}>
                Tap "Hold" on a cart to park it here while you serve another customer.
              </div>
            </div>
          ) : (
            held.map((h) => {
              const total = h.lines.reduce(
                (s, l) => s + l.unitPrice * l.quantity,
                0,
              );
              return (
                <div
                  key={h.id}
                  style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{h.label}</div>
                      <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                        {new Date(h.createdAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' · '}
                        {h.lines.length} item{h.lines.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div
                      className="num"
                      style={{ fontWeight: 900, fontSize: 14, color: T.accent }}
                    >
                      £{total.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button
                      small
                      full
                      onClick={() => {
                        recall(h.id);
                        onClose();
                      }}
                    >
                      Recall
                    </Button>
                    <Button
                      variant="danger"
                      small
                      onClick={() => {
                        if (confirm('Delete held order?')) deleteHeld(h.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
