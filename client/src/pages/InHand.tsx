import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, SpinLoading } from 'antd-mobile';
import styled from 'styled-components';
import { itemApi } from '../services/api';

const Container = styled.div`
  min-height: 100%;
  padding: 16px;
`;

const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
`;

const ItemCard = styled(Card)`
  margin-bottom: 12px;
`;

const ItemName = styled.div`
  font-size: 16px;
  font-weight: 500;
`;

const ItemMeta = styled.div`
  font-size: 13px;
  color: #999;
  margin-top: 4px;
`;

export default function InHand() {
  const navigate = useNavigate();
  const [inHandItems, setInHandItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const itemsRes: any = await itemApi.getAll();
      setInHandItems(itemsRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container style={{ textAlign: 'center', paddingTop: 60 }}>
        <SpinLoading />
      </Container>
    );
  }

  return (
    <Container>
      <SectionTitle>我借用的物品</SectionTitle>
      {inHandItems.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <p style={{ color: '#999', marginBottom: 12 }}>暂无借用物品</p>
          <Button size="small" onClick={() => navigate('/scanner')}>
            扫码借用
          </Button>
        </div>
      ) : (
        inHandItems.slice(0, 10).map((item) => (
          <ItemCard key={item.item_id}>
            <ItemName>{item.item_name}</ItemName>
            <ItemMeta>
              {item.room_name}
              {item.box_name && ` / ${item.box_name}`}
            </ItemMeta>
          </ItemCard>
        ))
      )}
    </Container>
  );
}
