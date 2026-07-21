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
      <div style={{ flex: 1 }}>
        <Skeleton.Paragraph animated lineCount={2} />
      </div>
    </div>
  );
}
