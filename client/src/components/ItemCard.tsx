import styled from 'styled-components';

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

  &:active {
    transform: scale(0.98);
  }
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
  flex-shrink: 0;
`;

const ItemInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding-top: 2px;
`;

const ItemName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

interface ItemCardProps {
  item: {
    item_id: number;
    item_name: string;
    item_image?: string;
    item_notice?: string;
    box_name?: string;
    room_name?: string;
    tags?: { tag_name: string }[];
  };
  onClick?: () => void;
}

export default function ItemCard({ item, onClick }: ItemCardProps) {
  return (
    <CardContainer onClick={onClick}>
      <ItemImage $image={item.item_image}>
        {!item.item_image && '📦'}
      </ItemImage>
      <ItemInfo>
        <ItemName>{item.item_name}</ItemName>
        {item.item_notice && <ItemMeta>{item.item_notice}</ItemMeta>}
        {item.tags && item.tags.length > 0 && (
          <ItemTags>
            {item.tags.slice(0, 2).map((tag, index) => (
              <Tag key={index}>{tag.tag_name}</Tag>
            ))}
          </ItemTags>
        )}
      </ItemInfo>
    </CardContainer>
  );
}
