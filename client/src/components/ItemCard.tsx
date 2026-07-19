import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../stores/cartStore';

const CardContainer = styled.div`
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: var(--app-shadow-card);
  cursor: pointer;
  transition: transform 0.2s;
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
  border-radius: var(--app-radius-s);
  background: ${(props) =>
    props.$image ? `url(${props.$image}) center/cover` : 'var(--app-color-img-placeholder)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-color-text-secondary);
  font-size: 24px;
`;

const StockStatus = styled.span<{ $inStock: boolean }>`
  position: absolute;
  right: 8px;
  top: 8px;
  font-size: 10px;
  padding: 2px 5px;
  border-radius: var(--app-radius-s);
  background: ${(props) => (props.$inStock ? 'var(--app-color-badge-instock-bg)' : 'var(--app-color-badge-outstock-bg)')};
  color: ${(props) => (props.$inStock ? 'var(--app-color-badge-instock-text)' : 'var(--app-color-badge-outstock-text)')};
  white-space: nowrap;
`;

const ItemInfo = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ItemName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--app-color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemMeta = styled.div`
  font-size: 12px;
  color: var(--app-color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const Tag = styled.span`
  font-size: 11px;
  padding: 2px 6px;
  background: var(--app-color-badge-foreign-bg);
  color: var(--app-color-badge-foreign-text);
  border-radius: var(--app-radius-s);
`;

const CartButton = styled.button<{ $inCart: boolean }>`
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  border: none;
  background: ${(props) => (props.$inCart ? 'var(--app-color-cart-btn-default-bg)' : 'var(--app-color-cart-btn-added-bg)')};
  color: ${(props) => (props.$inCart ? 'var(--app-color-cart-btn-default-icon)' : 'var(--app-color-cart-btn-added-icon)')};
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
  const { t } = useTranslation();
  const isInStock = item.is_in_stock !== false;
  const isForeign = item.is_foreign === true;
  const isInCart = useCartStore((s) => s.items.some((i) => i.itemId === item.item_id));
  const addItem = useCartStore((s) => s.addItem);
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
      </ImageSection>
      <ItemInfo>
        <ItemName>{displayName}</ItemName>
        {item.item_notice && <ItemMeta>{item.item_notice}</ItemMeta>}
        {showStockStatus && !isInStock && !isForeign && item.holder_nickname && (
          <ItemMeta>{t('itemCard.withPerson', { name: item.holder_nickname })}</ItemMeta>
        )}
        {item.tags && item.tags.length > 0 && (
          <ItemTags>
            {item.tags.slice(0, 2).map((tag) => (
              <Tag key={tag.tag_name}>{tag.tag_name}</Tag>
            ))}
          </ItemTags>
        )}
      </ItemInfo>
      {showCartButton && (
        <CartButton $inCart={isInCart} onClick={handleCartClick}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <line x1="12" y1="5" x2="12" y2="19" />
          </svg>
        </CartButton>
      )}
      {showStockStatus && (
        <StockStatus $inStock={isInStock || isForeign}>
          {isForeign ? t('itemCard.foreignItem') : (isInStock ? t('itemCard.inStock') : t('itemCard.outOfStock'))}
        </StockStatus>
      )}
    </CardContainer>
  );
}