import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';
import styled from 'styled-components';

const Card = styled.div`
  min-width: 0;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
  box-shadow: var(--app-shadow-card);
`;

const Info = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export function ItemCardSkeleton() {
  return (
    <Card aria-hidden="true">
      <Skeleton animated style={{ '--width': '56px', '--height': '56px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
      <Info>
        <Skeleton animated style={{ '--width': '70%', '--height': '17px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
      </Info>
    </Card>
  );
}
