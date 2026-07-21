import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, SearchBar } from 'antd-mobile';
import { OrderSkeleton } from '../components/skeleton';
import { useMinLoadingTime } from '../hooks/useMinLoadingTime';
import type { InputRef } from 'antd-mobile/es/components/input';
import { SearchOutline } from 'antd-mobile-icons';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { reservationApi } from '../services/api';
import { useRoomStore } from '../stores/roomStore';
import WarehouseSelector from '../components/WarehouseSelector';

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-color-bg);
`;

const Header = styled.div`
  background: var(--app-color-surface);
  padding: 1px 6px;
  border-bottom: 1px solid var(--app-color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 2px;
`;

const IconButton = styled.div`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  color: var(--app-color-text);

  &:active {
    opacity: 0.7;
  }
`;

const SearchContainer = styled.div`
  padding: 8px 12px;
  background: var(--app-color-surface);
`;

const TabBar = styled.div`
  background: var(--app-color-surface);
  display: flex;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-color-border);
`;

const TabItem = styled.div<{ $active?: boolean }>`
  padding: 10px 0 8px;
  font-size: 14px;
  color: ${(props) => (props.$active ? 'var(--app-color-primary)' : 'var(--app-color-text-weak)')};
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
    background: ${(props) => (props.$active ? 'var(--app-color-primary)' : 'transparent')};
  }
`;

const Content = styled.div`
  padding: 12px 16px;
  flex: 1;
  overflow-y: auto;
`;

const OrderCard = styled.div`
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--app-shadow-card);
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
  color: var(--app-color-text-secondary);
  font-weight: normal;
`;

const OrderMeta = styled.div`
  font-size: 13px;
  color: var(--app-color-text-weak);
  margin-bottom: 4px;
`;

const OrderTime = styled.div`
  font-size: 15px;
  color: var(--app-color-text);
  font-weight: 600;
  margin-top: 8px;
  padding-top: 12px;
  margin-bottom: 12px;
  border-top: 1px solid var(--app-color-border);
`;

const EmptyContainer = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: var(--app-color-text-secondary);
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
  const { t, i18n } = useTranslation();
  const { currentRoom } = useRoomStore();
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const searchInputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (currentRoom) {
      loadRoomOrders();
    } else {
      setLoading(false);
    }
  }, [currentRoom]);

  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [showSearch]);

  const filterOrders = (orders: Order[]) => {
    if (!searchText) return orders;
    return orders.filter((order) => {
      const title = order.order_title || t('cart.orderFallbackTitle', { id: order.order_id });
      return title.toLowerCase().includes(searchText.toLowerCase());
    });
  };

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
    return new Date(ts).toLocaleString(i18n.language === 'en-US' ? 'en-US' : 'zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Tag color="primary">{t('status.upcoming')}</Tag>;
      case 'active':
        return <Tag color="success">{t('status.active')}</Tag>;
      case 'completed':
        return <Tag color="default">{t('status.completed')}</Tag>;
      case 'canceled':
        return <Tag color="danger">{t('status.canceled')}</Tag>;
      default:
        return null;
    }
  };

  const renderOrderList = (orders: Order[]) => {
    if (orders.length === 0) {
      return <EmptyContainer>{t('reservationOrders.noOrders')}</EmptyContainer>;
    }

    return orders.map((order) => (
      <OrderCard
        key={order.order_id}
        onClick={() => navigate(`/reservation-orders/${order.order_id}`)}
      >
        <OrderHeader>
          <OrderTitle>
            {order.order_title || t('cart.orderFallbackTitle', { id: order.order_id })}
            {order.order_user_nickname && (
              <OrderUser>- {order.order_user_nickname}</OrderUser>
            )}
          </OrderTitle>
          {getStatusTag(order.order_status)}
        </OrderHeader>
        {order.start_time && order.end_time && (
          <OrderTime>
            📅 {formatTime(order.start_time)} ~ {formatTime(order.end_time)}
          </OrderTime>
        )}
        <OrderMeta>
          {t('reservationOrders.itemCount', { active: order.active_items, total: order.total_items })}
        </OrderMeta>
      </OrderCard>
    ));
  };

  const showSkeleton = useMinLoadingTime(loading);

  if (showSkeleton) {
    return (
      <Container>
        <Header>
          <WarehouseSelector />
          <HeaderActions>
            <IconButton onClick={() => setShowSearch(true)}>
              <SearchOutline />
            </IconButton>
          </HeaderActions>
        </Header>
        <div style={{ padding: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => <OrderSkeleton key={i} />)}
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <WarehouseSelector />
        {currentRoom && (
          <HeaderActions>
            <IconButton onClick={() => setShowSearch(true)}>
              <SearchOutline />
            </IconButton>
          </HeaderActions>
        )}
      </Header>
      {showSearch && currentRoom && (
        <SearchContainer>
          <SearchBar
            ref={searchInputRef}
            placeholder={t('reservationOrders.searchPlaceholder')}
            value={searchText}
            onChange={(val) => setSearchText(val)}
            onSearch={(val) => setSearchText(val)}
            showCancelButton
            onCancel={() => {
              setSearchText('');
              setShowSearch(false);
            }}
            onClear={() => setSearchText('')}
          />
        </SearchContainer>
      )}
      <TabBar>
        <TabItem $active={activeTab === 'active'} onClick={() => setActiveTab('active')}>
          {t('reservationOrders.active')} ({filterOrders(activeOrders).length})
        </TabItem>
        <TabItem $active={activeTab === 'past'} onClick={() => setActiveTab('past')}>
          {t('reservationOrders.past')} ({filterOrders(pastOrders).length})
        </TabItem>
      </TabBar>
      <Content>
        {activeTab === 'active' ? renderOrderList(filterOrders(activeOrders)) : renderOrderList(filterOrders(pastOrders))}
      </Content>
    </Container>
  );
}
