import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

interface DetailSkeletonProps {
  withImage?: boolean;
  card?: boolean;
}

export function DetailSkeleton({ withImage = true, card = false }: DetailSkeletonProps) {
  const inner = (
    <>
      {withImage && (
        <Skeleton animated style={{ '--width': '80px', '--height': '80px', '--border-radius': 'var(--app-radius-m)' } as CSSProperties} />
      )}
      <div style={{ flex: 1 }}>
        <Skeleton animated style={{ '--width': '50%', '--height': '18px' } as CSSProperties} />
        <div style={{ marginTop: 12 }}>
          <Skeleton.Paragraph animated lineCount={3} />
        </div>
      </div>
    </>
  );

  if (card) {
    return (
      <div style={{ display: 'flex', gap: 16, background: 'var(--app-color-surface)', borderRadius: 'var(--app-radius-m)', padding: 16, boxShadow: 'var(--app-shadow-card)' }}>
        {inner}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {inner}
    </div>
  );
}
