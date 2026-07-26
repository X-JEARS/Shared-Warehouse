import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

export function ReservationGridSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ background: 'var(--app-color-surface)', borderRadius: 'var(--app-radius-m)', padding: 12 }}>
          <Skeleton animated style={{ '--width': '40px', '--height': '16px', '--border-radius': 'var(--app-radius-pill)' } as CSSProperties} />
          <Skeleton animated style={{ '--width': '80%', '--height': '15px', marginTop: 10 } as CSSProperties} />
          <Skeleton animated style={{ '--width': '60%', '--height': '13px', marginTop: 6 } as CSSProperties} />
          <Skeleton animated style={{ '--width': '90%', '--height': '12px', marginTop: 10 } as CSSProperties} />
        </div>
      ))}
    </div>
  );
}
