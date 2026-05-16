import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, SpinLoading } from 'antd-mobile';
import styled from 'styled-components';
import { reservationApi } from '../services/api';
import { useRoomStore } from '../stores/roomStore';

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
`;

const Header = styled.div`
  background: white;
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
`;

const TabBar = styled.div`
  background: white;
  display: flex;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
`;

const TabItem = styled.div<{ $active?: boolean }>`
  padding: 10px 0 8px;
  font-size: 14px;
  color: ${(props) => (props.$active ? '#1677ff' : '#666')};
  font-weight: ${(props) => (props.$active ? 500 : 400)};
  position: relative;
  cursor: pointer;
  margin-right: 20px;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    border-radius: 1px;
    background: ${(props) => (props.$active ? '#1677ff' : 'transparent')};
  }
`;

const Content = styled.div`
  padding: 12px 16px;
  flex: 1;
  overflow-y: auto;
`;

const OrderCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const OrderHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const OrderTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const OrderUser = styled.span`
  font-size: 13px;
  color: #999;
  font-weight: normal;
`;

const OrderMeta = styled.div`
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
`;

const OrderTime = styled.div`
  font-size: 15px;
  color: #333;
  font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
`;

const EmptyContainer = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #999;
`;

const NoRoomTip = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #999;
`;

interface Order {
  order_id: number;
  order_create_time: number;
  order_title: string | null;
  order_is_canceled: boolean;
  order_user_nickname?: string;
  total_items: string;
  active_items: string;
  start_time: number | null;
  end_time: number | null;
  order_status: string;
}

export default function ReservationOrders() {
  const navigate = useNavigate();
  const { currentRoom } = useRoomStore();
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');

  useEffect(() => {
    if (currentRoom) {
      loadRoomOrders();
    } else {
      setLoading(false);
    }
  }, [currentRoom]);

  const loadRoomOrders = async () => {
    if (!currentRoom) return;
    try {
      setLoading(true);
      const [activeRes, pastRes]: any[] = await Promise.all([
        reservationApi.getRoomOrders(currentRoom.room_id, 'active'),
        reservationApi.getRoomOrders(currentRoom.room_id, 'past'),
      ]);
      setActiveOrders(activeRes.data || []);
      setPastOrders(pastRes.data || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: number | string | null) => {
    if (!timestamp) return '--';
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    return new Date(ts).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Tag color="primary">即将开始</Tag>;
      case 'active':
        return <Tag color="success">进行中</Tag>;
      case 'completed':
        return <Tag color="default">已完成</Tag>;
      case 'canceled':
        return <Tag color="danger">已取消</Tag>;
      default:
        return null;
    }
  };

  const renderOrderList = (orders: Order[]) => {
    if (orders.length === 0) {
      return <EmptyContainer>暂无预约订单</EmptyContainer>;
    }

    return orders.map((order) => (
      <OrderCard
        key={order.order_id}
        onClick={() => navigate(`/reservation-orders/${order.order_id}`)}
      >
        {order.start_time && order.end_time && (
          <OrderTime>
            📅 {formatTime(order.start_time)} ~ {formatTime(order.end_time)}
          </OrderTime>
        )}
        <OrderHeader>
          <OrderTitle>
            {order.order_title || `预约单 #${order.order_id}`}
            {order.order_user_nickname && (
              <OrderUser>- {order.order_user_nickname}</OrderUser>
            )}
          </OrderTitle>
          {getStatusTag(order.order_status)}
        </OrderHeader>
        <OrderMeta>
          物品数量：{order.active_items} / {order.total_items} 个
        </OrderMeta>
        <OrderMeta>
          创建时间：{formatTime(order.order_create_time)}
        </OrderMeta>
      </OrderCard>
    ));
  };

  if (loading) {
    return (
      <Container>
        <Header>
          <HeaderTitle>仓库预约</HeaderTitle>
        </Header>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <SpinLoading />
        </div>
      </Container>
    );
  }

  if (!currentRoom) {
    return (
      <Container>
        <Header>
          <HeaderTitle>仓库预约</HeaderTitle>
        </Header>
        <NoRoomTip>请先选择一个仓库</NoRoomTip>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <HeaderTitle>仓库预约</HeaderTitle>
      </Header>
      <TabBar>
        <TabItem $active={activeTab === 'active'} onClick={() => setActiveTab('active')}>
          进行中 ({activeOrders.length})
        </TabItem>
        <TabItem $active={activeTab === 'past'} onClick={() => setActiveTab('past')}>
          已结束 ({pastOrders.length})
        </TabItem>
      </TabBar>
      <Content>
        {activeTab === 'active' ? renderOrderList(activeOrders) : renderOrderList(pastOrders)}
      </Content>
    </Container>
  );
}