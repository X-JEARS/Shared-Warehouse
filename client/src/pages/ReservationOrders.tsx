import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Tag, SpinLoading, Tabs } from 'antd-mobile';
import styled from 'styled-components';
import { reservationApi } from '../services/api';

const Container = styled.div`
  min-height: 100%;
  background: #f5f5f5;
`;

const Content = styled.div`
  padding: 12px 16px;
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
`;

const OrderMeta = styled.div`
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
`;

const OrderTime = styled.div`
  font-size: 14px;
  color: #333;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
`;

const EmptyContainer = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #999;
`;

interface Order {
  order_id: number;
  order_create_time: number;
  order_title: string | null;
  order_is_canceled: boolean;
  total_items: string;
  active_items: string;
  start_time: number | null;
  end_time: number | null;
  order_status: string;
}

export default function ReservationOrders() {
  const navigate = useNavigate();
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const [activeRes, pastRes]: any[] = await Promise.all([
        reservationApi.getOrders('active'),
        reservationApi.getOrders('past'),
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
        <OrderHeader>
          <OrderTitle>
            {order.order_title || `预约单 #${order.order_id}`}
          </OrderTitle>
          {getStatusTag(order.order_status)}
        </OrderHeader>
        <OrderMeta>
          创建时间：{formatTime(order.order_create_time)}
        </OrderMeta>
        <OrderMeta>
          物品数量：{order.active_items} / {order.total_items} 个
        </OrderMeta>
        {order.start_time && order.end_time && (
          <OrderTime>
            📅 {formatTime(order.start_time)} ~ {formatTime(order.end_time)}
          </OrderTime>
        )}
      </OrderCard>
    ));
  };

  if (loading) {
    return (
      <Container>
        <NavBar onBack={() => navigate(-1)}>预约订单</NavBar>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <SpinLoading />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <NavBar onBack={() => navigate(-1)}>预约订单</NavBar>
      <Tabs>
        <Tabs.Tab title={`进行中 (${activeOrders.length})`} key="active">
          <Content>{renderOrderList(activeOrders)}</Content>
        </Tabs.Tab>
        <Tabs.Tab title={`已结束 (${pastOrders.length})`} key="past">
          <Content>{renderOrderList(pastOrders)}</Content>
        </Tabs.Tab>
      </Tabs>
    </Container>
  );
}
