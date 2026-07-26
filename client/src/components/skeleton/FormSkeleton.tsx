import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

export function FormSkeleton() {
  return (
    <div style={{ marginBottom: 16 }}>
      <Skeleton animated style={{ '--width': '30%', '--height': '14px', marginBottom: 8 } as CSSProperties} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Skeleton animated style={{ '--width': '60px', '--height': '28px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '50px', '--height': '28px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '70px', '--height': '28px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
      </div>
    </div>
  );
}
