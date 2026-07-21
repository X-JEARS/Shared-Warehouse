import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

export function ItemCardSkeleton() {
  return (
    <div style={{ background: 'var(--app-color-surface)', borderRadius: 'var(--app-radius-card)', padding: 12 }}>
      <Skeleton animated style={{ '--width': '56px', '--height': '56px', '--border-radius': 'var(--app-radius-m)' } as CSSProperties} />
      <div style={{ marginTop: 8 }}>
        <Skeleton animated style={{ '--width': '70%', '--height': '14px' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '40%', '--height': '12px', '--border-radius': 'var(--app-radius-pill)' } as CSSProperties} />
      </div>
    </div>
  );
}
