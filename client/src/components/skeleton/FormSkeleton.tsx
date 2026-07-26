import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

export function FormSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
      <Skeleton animated style={{ '--width': '60px', '--height': '14px', marginTop: 6, flexShrink: 0 } as CSSProperties} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1 }}>
        <Skeleton animated style={{ '--width': '60px', '--height': '28px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '50px', '--height': '28px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '70px', '--height': '28px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
      </div>
    </div>
  );
}
