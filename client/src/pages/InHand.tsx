import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, SearchBar, SpinLoading } from 'antd-mobile';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { swrFetcher } from '../utils/swr';
import ItemCard from '../components/ItemCard';
import ItemDetail from '../components/ItemDetail';

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  background: var(--app-color-surface);
  padding: 8px 16px;
  border-bottom: 1px solid var(--app-color-border);
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
`;

const SearchContainer = styled.div`
  padding: 12px 16px;
  background: var(--app-color-surface);
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
  color: var(--app-color-text-secondary);
  margin-bottom: 16px;
`;

export default function InHand() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const { data, isLoading } = useSWR('/items/in-hand', swrFetcher, {
    revalidateOnFocus: false,
  });

  const items = data || [];

  const handleItemClick = (itemId: number) => {
    setSelectedItem(itemId);
    setDetailVisible(true);
  };

  const filteredItems = useMemo(() => {
    if (!searchText) return items;
    const text = searchText.toLowerCase();
    return items.filter((item: any) =>
      item.item_name?.toLowerCase().includes(text) ||
      item.item_notice?.toLowerCase().includes(text)
    );
  }, [items, searchText]);

  if (isLoading) {
    return (
      <Container>
        <Header>
          <HeaderTitle>{t('inHand.title')}</HeaderTitle>
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
        <HeaderTitle>{t('inHand.title')}</HeaderTitle>
      </Header>

      <SearchContainer>
        <SearchBar
          value={searchText}
          onChange={setSearchText}
          placeholder={t('inHand.searchPlaceholder')}
          showCancelButton
        />
      </SearchContainer>

      <Content>
        {filteredItems.length === 0 ? (
          <EmptyContainer>
            <EmptyText>
              {searchText ? t('inHand.noMatch') : t('inHand.noItems')}
            </EmptyText>
            {!searchText && (
              <Button color="primary" onClick={() => navigate('/scanner')}>
                {t('inHand.scanToBorrow')}
              </Button>
            )}
          </EmptyContainer>
        ) : (
          <ItemGrid>
            {filteredItems.map((item: any) => (
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
