import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';
import styled from 'styled-components';

const Card = styled.div`
  padding: 16px;
  margin-bottom: 12px;
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
  box-shadow: var(--app-shadow-card);
`;

const Header = styled.div`
  min-width: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const Time = styled.div`
  padding-top: 12px;
  margin: 8px 0 12px;
  border-top: 1px solid var(--app-color-border);
`;

export function OrderSkeleton() {
  return (
    <Card aria-hidden="true">
      <Header>
        <Skeleton animated style={{ '--width': '48%', '--height': '16px' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '52px', '--height': '22px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
      </Header>
      <Time>
        <Skeleton animated style={{ '--width': '78%', '--height': '15px' } as CSSProperties} />
      </Time>
      <Skeleton animated style={{ '--width': '42%', '--height': '13px' } as CSSProperties} />
    </Card>
  );
}
