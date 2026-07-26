import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

export function NotificationSkeleton() {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--app-color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Skeleton animated style={{ '--width': '20px', '--height': '20px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '60%', '--height': '15px' } as CSSProperties} />
      </div>
      <Skeleton animated style={{ '--width': '85%', '--height': '13px', marginBottom: 4 } as CSSProperties} />
      <Skeleton animated style={{ '--width': '40%', '--height': '12px' } as CSSProperties} />
    </div>
  );
}
