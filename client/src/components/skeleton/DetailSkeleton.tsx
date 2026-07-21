import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

export function DetailSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <Skeleton animated style={{ '--width': '80px', '--height': '80px', '--border-radius': 'var(--app-radius-m)' } as CSSProperties} />
      <div style={{ flex: 1 }}>
        <Skeleton animated style={{ '--width': '50%', '--height': '18px' } as CSSProperties} />
        <div style={{ marginTop: 12 }}>
          <Skeleton.Paragraph animated lineCount={3} />
        </div>
      </div>
    </div>
  );
}
