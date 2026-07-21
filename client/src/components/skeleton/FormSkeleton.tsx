import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

export function FormSkeleton() {
  return (
    <div style={{ marginBottom: 16 }}>
      <Skeleton animated style={{ '--width': '30%', '--height': '14px', marginBottom: 8 } as CSSProperties} />
      <Skeleton animated style={{ '--width': '100%', '--height': '44px', '--border-radius': 'var(--app-radius-input)' } as CSSProperties} />
    </div>
  );
}
