import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

export function OrderSkeleton() {
  return (
    <div style={{ background: 'var(--app-color-surface)', borderRadius: 'var(--app-radius-card)', padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Skeleton animated style={{ '--width': '40%', '--height': '16px' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '60px', '--height': '14px', '--border-radius': 'var(--app-radius-pill)' } as CSSProperties} />
      </div>
      <Skeleton.Paragraph animated lineCount={2} />
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Skeleton animated style={{ '--width': '80px', '--height': '32px', '--border-radius': 'var(--app-radius-btn)' } as CSSProperties} />
      </div>
    </div>
  );
}
