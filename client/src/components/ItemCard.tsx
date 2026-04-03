import styled from 'styled-components';
import { useCartStore } from '../stores/cartStore';

const CardContainer = styled.div`
  background: white;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  gap: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s;
  height: 72px;
  position: relative;

  &:active {
    transform: scale(0.98);
  }
`;

const ImageSection = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const ItemImage = styled.div<{ $image?: string }>`
  width: 56px;
  height: 56px;
  border-radius: 6px;
  background: ${(props) =>
    props.$image ? `url(${props.$image}) center/cover` : '#f0f0f0'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 24px;
`;

const StockStatus = styled.span<{ $inStock: boolean }>`
  position: absolute;
  left: 63px;
  bottom: 0;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${(props) => (props.$inStock ? '#e6f7e6' : '#fff0f0')};
  color: ${(props) => (props.$inStock ? '#52c41a' : '#ff4d4f')};
  white-space: nowrap;
`;

const ItemInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding-top: 2px;
`;

const ItemHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ItemName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
`;

const ItemMeta = styled.div`
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
`;

const Tag = styled.span`
  font-size: 11px;
  padding: 2px 6px;
  background: #e6f4ff;
  color: #1677ff;
  border-radius: 4px;
`;

const CartButton = styled.button<{ $inCart: boolean }>`
  position: absolute;
  right: 8px;
  bottom: 8px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  border: none;
  background: ${(props) => (props.$inCart ? '#d9d9d9' : '#1677ff')};
  color: white;
  cursor: pointer;
  transition: all 0.2s;

  &:active {
    transform: scale(0.95);
  }
`;

interface ItemCardProps {
  item: {
    item_id: number;
    item_name: string;
    item_image?: string;
    item_notice?: string;
    item_qrcode?: string;
    box_name?: string;
    room_name?: string;
    tags?: { tag_name: string }[];
    is_in_stock?: boolean;
    is_foreign?: boolean;
    holder_nickname?: string;
    remark?: string;
  };
  onClick?: () => void;
  showStockStatus?: boolean;
  showCartButton?: boolean;
}

export default function ItemCard({ item, onClick, showStockStatus = true, showCartButton = false }: ItemCardProps) {
  const isInStock = item.is_in_stock !== false;
  const isForeign = item.is_foreign === true;
  const { items: cartItems, addItem } = useCartStore();
  const isInCart = cartItems.some((i) => i.itemId === item.item_id);
  const displayName = item.remark || item.item_name;

  const handleCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isInCart) {
      addItem({
        itemId: item.item_id,
        itemName: displayName,
        itemQrcode: item.item_qrcode || '',
        itemImage: item.item_image,
        boxName: item.box_name,
        roomName: item.room_name,
      });
    }
  };

  return (
    <CardContainer onClick={onClick}>
      <ImageSection>
        <ItemImage $image={item.item_image}>
          {!item.item_image && '📦'}
        </ItemImage>
        {showStockStatus && (
          <StockStatus $inStock={isInStock || isForeign}>
            {isForeign ? '外来物品' : (isInStock ? '在库' : '离库')}
          </StockStatus>
        )}
      </ImageSection>
      <ItemInfo>
        <ItemHeader>
          <ItemName>{displayName}</ItemName>
        </ItemHeader>
        {item.item_notice && <ItemMeta>{item.item_notice}</ItemMeta>}
        {showStockStatus && !isInStock && !isForeign && item.holder_nickname && (
          <ItemMeta>正在: {item.holder_nickname}</ItemMeta>
        )}
        {item.tags && item.tags.length > 0 && (
          <ItemTags>
            {item.tags.slice(0, 2).map((tag, index) => (
              <Tag key={index}>{tag.tag_name}</Tag>
            ))}
          </ItemTags>
        )}
      </ItemInfo>
      {showCartButton && (
        <CartButton $inCart={isInCart} onClick={handleCartClick}>
          预约
        </CartButton>
      )}
    </CardContainer>
  );
}
