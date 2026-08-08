import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => <ListItemSkeleton key={i} />)}
    </>
  );
}

function ListItemSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--app-color-border)' }}>
      <Skeleton animated style={{ '--width': '40px', '--height': '40px', '--border-radius': '50%' } as CSSProperties} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton animated style={{ '--width': '72%', '--height': '14px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '88%', '--height': '13px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
      </div>
    </div>
  );
}
