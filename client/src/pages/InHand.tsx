import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, SearchBar, SpinLoading } from 'antd-mobile';
import styled from 'styled-components';
import { itemApi } from '../services/api';
import ItemCard from '../components/ItemCard';
import ItemDetail from '../components/ItemDetail';

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  background: white;
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
`;

const SearchContainer = styled.div`
  padding: 12px 16px;
  background: white;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
`;

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
`;

const EmptyContainer = styled.div`
  text-align: center;
  padding: 40px 20px;
`;

const EmptyText = styled.p`
  color: #999;
  margin-bottom: 16px;
`;

export default function InHand() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res: any = await itemApi.getInHand();
      setItems(res.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (itemId: number) => {
    setSelectedItem(itemId);
    setDetailVisible(true);
  };

  // 前端搜索过滤
  const filteredItems = items.filter((item) => {
    if (!searchText) return true;
    const text = searchText.toLowerCase();
    return (
      item.item_name?.toLowerCase().includes(text) ||
      item.item_notice?.toLowerCase().includes(text)
    );
  });

  if (loading) {
    return (
      <Container>
        <Header>
          <HeaderTitle>我手中的</HeaderTitle>
        </Header>
        <Content>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <SpinLoading />
          </div>
        </Content>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <HeaderTitle>我手中的</HeaderTitle>
      </Header>

      <SearchContainer>
        <SearchBar
          value={searchText}
          onChange={setSearchText}
          placeholder="搜索物品..."
          showCancelButton
        />
      </SearchContainer>

      <Content>
        {filteredItems.length === 0 ? (
          <EmptyContainer>
            <EmptyText>
              {searchText ? '没有找到匹配的物品' : '暂无借用物品'}
            </EmptyText>
            {!searchText && (
              <Button color="primary" onClick={() => navigate('/scanner')}>
                扫码借用
              </Button>
            )}
          </EmptyContainer>
        ) : (
          <ItemGrid>
            {filteredItems.map((item) => (
              <ItemCard
                key={item.item_id}
                item={item}
                onClick={() => handleItemClick(item.item_id)}
                showStockStatus={false}
              />
            ))}
          </ItemGrid>
        )}
      </Content>

      <ItemDetail
        visible={detailVisible}
        itemId={selectedItem}
        onClose={() => setDetailVisible(false)}
      />
    </Container>
  );
}
