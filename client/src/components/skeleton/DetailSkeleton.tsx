import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';
import styled from 'styled-components';

const Summary = styled.div`
  min-width: 0;
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
`;

const SummaryInfo = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export function DetailSkeleton() {
  return (
    <Summary aria-hidden="true">
      <Skeleton animated style={{ '--width': '80px', '--height': '80px', '--border-radius': 'var(--app-radius-m)' } as CSSProperties} />
      <SummaryInfo>
        <Skeleton animated style={{ '--width': '58%', '--height': '18px' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '82%', '--height': '13px' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '68%', '--height': '13px' } as CSSProperties} />
      </SummaryInfo>
    </Summary>
  );
}
