import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';
import styled from 'styled-components';

const MyItemCard = styled.div`
  padding: 16px;
  margin-bottom: 12px;
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
  box-shadow: 0 1px 3px var(--app-shadow-card);
`;

const MyItemRow = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const MyItemInfo = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 7px;
`;

export function MyItemListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <MyItemCard key={index}>
          <MyItemRow>
            <Skeleton animated style={{ '--width': '60px', '--height': '60px', '--border-radius': 'var(--app-radius-m)' } as CSSProperties} />
            <MyItemInfo>
              <Skeleton animated style={{ '--width': '58%', '--height': '15px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
              <Skeleton animated style={{ '--width': '88%', '--height': '13px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
              <Skeleton animated style={{ '--width': '74%', '--height': '13px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
            </MyItemInfo>
          </MyItemRow>
        </MyItemCard>
      ))}
    </div>
  );
}

const NotificationRow = styled.div`
  padding: 16px;
  border-bottom: 1px solid var(--app-color-border);
`;

const NotificationLines = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export function NotificationListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <NotificationRow key={index}>
          <NotificationLines>
            <Skeleton animated style={{ '--width': index % 2 === 0 ? '46%' : '58%', '--height': '15px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
            <Skeleton animated style={{ '--width': index % 3 === 0 ? '76%' : '88%', '--height': '13px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
            <Skeleton animated style={{ '--width': '24%', '--height': '12px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
          </NotificationLines>
        </NotificationRow>
      ))}
    </div>
  );
}

const TransferCard = styled.div`
  padding: 14px;
  margin-bottom: 12px;
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
  box-shadow: var(--app-shadow-card);
`;

const TransferHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const TransferItems = styled.div`
  margin-top: 12px;
  border-top: 1px solid var(--app-color-border);
`;

const TransferItem = styled.div`
  min-width: 0;
  min-height: 54px;
  padding: 8px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--app-color-border);

  &:last-child {
    padding-bottom: 0;
    border-bottom: 0;
  }
`;

const TransferItemInfo = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

export function TransferRecordListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }).map((_, cardIndex) => (
        <TransferCard key={cardIndex}>
          <TransferHeader>
            <Skeleton animated style={{ '--width': '34%', '--height': '24px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
            <Skeleton animated style={{ '--width': '30%', '--height': '12px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
          </TransferHeader>
          <TransferItems>
            {Array.from({ length: 2 }).map((_, itemIndex) => (
              <TransferItem key={itemIndex}>
                <Skeleton animated style={{ '--width': '38px', '--height': '38px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
                <TransferItemInfo>
                  <Skeleton animated style={{ '--width': itemIndex === 0 ? '52%' : '64%', '--height': '14px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
                  <Skeleton animated style={{ '--width': '72%', '--height': '12px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
                </TransferItemInfo>
              </TransferItem>
            ))}
          </TransferItems>
        </TransferCard>
      ))}
    </div>
  );
}

const ReservationInfo = styled.div`
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
`;

const ReservationSectionTitle = styled.div`
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ReservationGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
`;

const ReservationCard = styled.div`
  min-width: 0;
  min-height: 112px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
`;

export function ReservationDetailSkeleton() {
  return (
    <div aria-hidden="true">
      <ReservationInfo>
        <Skeleton animated style={{ '--width': '54%', '--height': '18px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '36%', '--height': '14px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '68%', '--height': '14px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
      </ReservationInfo>
      <ReservationSectionTitle>
        <Skeleton animated style={{ '--width': '32%', '--height': '15px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '68px', '--height': '28px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
      </ReservationSectionTitle>
      <ReservationGrid>
        {Array.from({ length: 6 }).map((_, index) => (
          <ReservationCard key={index}>
            <Skeleton animated style={{ '--width': '46px', '--height': '20px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
            <Skeleton animated style={{ '--width': '74%', '--height': '15px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
            <Skeleton animated style={{ '--width': '88%', '--height': '13px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
            <Skeleton animated style={{ '--width': '66%', '--height': '13px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
          </ReservationCard>
        ))}
      </ReservationGrid>
    </div>
  );
}
