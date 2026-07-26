import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

export function TransferRecordSkeleton() {
  return (
    <div style={{ background: 'var(--app-color-surface)', borderRadius: 'var(--app-radius-m)', padding: 14, marginBottom: 12, boxShadow: 'var(--app-shadow-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Skeleton animated style={{ '--width': '52px', '--height': '20px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
            <Skeleton animated style={{ '--width': '40px', '--height': '13px' } as CSSProperties} />
          </div>
          <Skeleton animated style={{ '--width': '60%', '--height': '12px', marginTop: 8 } as CSSProperties} />
        </div>
        <Skeleton animated style={{ '--width': '80px', '--height': '60px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
      </div>
      <div style={{ marginTop: 12, borderTop: '1px solid var(--app-color-border)', paddingTop: 8 }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <Skeleton animated style={{ '--width': '38px', '--height': '38px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
            <div style={{ flex: 1 }}>
              <Skeleton animated style={{ '--width': '70%', '--height': '14px' } as CSSProperties} />
              <Skeleton animated style={{ '--width': '50%', '--height': '12px', marginTop: 4 } as CSSProperties} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
