import styled from 'styled-components';
import { CloseOutline } from 'antd-mobile-icons';
import { useTranslation } from 'react-i18next';

export interface PendingItem {
  itemId: number;
  itemName: string;
  itemImage?: string;
  locationName: string;
  isInHand: boolean;
  qrcode: string;
}

interface ScanResultListProps {
  items: PendingItem[];
  onRemoveItem: (qrcode: string) => void;
}

const ListContainer = styled.div`
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  background: var(--app-color-surface);
  border-radius: var(--app-radius-l);
  padding: 8px;
`;

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
`;

const ItemCard = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 8px;
  background: var(--app-color-bg);
  border-radius: var(--app-radius-m);
`;

const ItemImage = styled.img`
  width: 36px;
  height: 36px;
  border-radius: var(--app-radius-s);
  object-fit: cover;
  background: var(--app-color-bg);
  flex-shrink: 0;
`;

const ItemPlaceholder = styled.div`
  width: 36px;
  height: 36px;
  border-radius: var(--app-radius-s);
  background: var(--app-color-img-placeholder);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
`;

const ItemInfo = styled.div`
  flex: 1;
  min-width: 0;
  margin-left: 8px;
`;

const ItemName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--app-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemLocation = styled.div`
  font-size: 11px;
  color: var(--app-color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const InHandBadge = styled.span`
  max-width: 100%;
  font-size: 11px;
  color: var(--app-color-text-secondary);
  background: var(--app-color-img-placeholder);
  padding: 1px 4px;
  border-radius: var(--app-radius-s);
  display: inline-block;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RemoveButton = styled.div`
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--app-color-placeholder);
  flex-shrink: 0;
  margin-left: 4px;

  &:active {
    color: var(--app-color-primary);
  }
`;

const EmptyHint = styled.div`
  text-align: center;
  color: var(--app-color-text-secondary);
  padding: 20px;
  font-size: 14px;
`;

export default function ScanResultList({ items, onRemoveItem }: ScanResultListProps) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return <EmptyHint>{t('scanResultList.noItems')}</EmptyHint>;
  }

  return (
    <ListContainer>
      <ItemGrid>
        {items.map((item) => (
          <ItemCard key={item.qrcode}>
            {item.itemImage ? (
              <ItemImage
                src={item.itemImage}
                alt={item.itemName}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <ItemPlaceholder>📦</ItemPlaceholder>
            )}
            <ItemInfo>
              <ItemName>{item.itemName}</ItemName>
              {item.isInHand && <InHandBadge>{t('scanResultList.inHand')}</InHandBadge>}
              <ItemLocation>{item.locationName}</ItemLocation>
            </ItemInfo>
            <RemoveButton onClick={() => onRemoveItem(item.qrcode)}>
              <CloseOutline fontSize={14} />
            </RemoveButton>
          </ItemCard>
        ))}
      </ItemGrid>
    </ListContainer>
  );
}
