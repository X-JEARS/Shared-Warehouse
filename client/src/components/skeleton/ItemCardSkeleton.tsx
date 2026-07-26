import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

// 对齐 components/ItemCard.tsx 的 CardContainer：padding 8、radius m、shadow、flex column gap 6
export function ItemCardSkeleton() {
  return (
    <div style={{
      background: 'var(--app-color-surface)',
      borderRadius: 'var(--app-radius-m)',
      padding: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      boxShadow: 'var(--app-shadow-card)',
    }}>
      <Skeleton animated style={{ '--width': '56px', '--height': '56px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Skeleton animated style={{ '--width': '70%', '--height': '14px' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '40%', '--height': '12px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
      </div>
    </div>
  );
}
