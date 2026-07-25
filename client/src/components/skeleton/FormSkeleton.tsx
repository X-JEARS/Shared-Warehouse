import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';
import styled from 'styled-components';

const SelectorGrid = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
  gap: 8px;
`;

export function FormSkeleton() {
  return (
    <SelectorGrid aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton
          key={index}
          animated
          style={{ '--width': '100%', '--height': '32px', '--border-radius': 'var(--app-radius-m)' } as CSSProperties}
        />
      ))}
    </SelectorGrid>
  );
}
