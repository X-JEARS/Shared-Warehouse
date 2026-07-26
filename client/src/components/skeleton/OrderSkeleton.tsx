import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

export function OrderSkeleton() {
  return (
    <div style={{ background: 'var(--app-color-surface)', borderRadius: 'var(--app-radius-m)', padding: 16, marginBottom: 12, boxShadow: 'var(--app-shadow-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Skeleton animated style={{ '--width': '40%', '--height': '16px' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '60px', '--height': '14px', '--border-radius': 'var(--app-radius-pill)' } as CSSProperties} />
      </div>
      <Skeleton.Paragraph animated lineCount={2} />
    </div>
  );
}
