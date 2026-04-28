import styled from 'styled-components';
import { CloseOutline } from 'antd-mobile-icons';

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
  max-height: 40vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 12px;
  padding: 8px;
  margin-top: 12px;
`;

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`;

const ItemCard = styled.div`
  display: flex;
  align-items: center;
  padding: 8px;
  background: #fafafa;
  border-radius: 8px;
`;

const ItemImage = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 6px;
  object-fit: cover;
  background: #f5f5f5;
  flex-shrink: 0;
`;

const ItemPlaceholder = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: #f5f5f5;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemLocation = styled.div`
  font-size: 11px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const InHandBadge = styled.span`
  font-size: 11px;
  color: #999;
  background: #f0f0f0;
  padding: 1px 4px;
  border-radius: 3px;
  margin-left: 4px;
`;

const RemoveButton = styled.div`
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #ccc;
  flex-shrink: 0;
  margin-left: 4px;

  &:active {
    color: #1677ff;
  }
`;

const EmptyHint = styled.div`
  text-align: center;
  color: #999;
  padding: 20px;
  font-size: 14px;
`;

export default function ScanResultList({ items, onRemoveItem }: ScanResultListProps) {
  if (items.length === 0) {
    return <EmptyHint>暂无扫描物品</EmptyHint>;
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
              <ItemName>
                {item.itemName}
                {item.isInHand && <InHandBadge>已在手中</InHandBadge>}
              </ItemName>
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