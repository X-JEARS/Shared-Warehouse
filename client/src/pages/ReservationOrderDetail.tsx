import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Tag, SpinLoading, Dialog, Toast, DatePicker, Input } from 'antd-mobile';
import styled, { css } from 'styled-components';
import { reservationApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

function EditIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-color-bg);
`;

const Header = styled.div`
  background: var(--app-color-surface);
  padding: 8px 16px;
  border-bottom: 1px solid var(--app-color-border);
  display: flex;
  align-items: center;
`;

const BackButton = styled.span`
  font-size: 20px;
  cursor: pointer;
  margin-right: 12px;
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
`;

const Content = styled.div`
  padding: 16px;
  padding-bottom: 100px;
  flex: 1;
  overflow-y: auto;
`;

const OrderInfo = styled.div`
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
  padding: 16px;
  margin-bottom: 16px;
`;

const OrderTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
`;

const OrderTitleRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 12px;
`;

const EditIconButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--app-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  flex-shrink: 0;

  &:hover {
    opacity: 0.8;
  }
`;

const OrderMeta = styled.div`
  font-size: 14px;
  color: var(--app-color-text-weak);
  margin-bottom: 8px;
`;

const SectionTitle = styled.div`
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 12px;
  color: var(--app-color-text);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ViewToggle = styled.div`
  display: flex;
  gap: 4px;
  background: var(--app-color-border);
  border-radius: 6px;
  padding: 2px;
`;

const ViewToggleBtn = styled.div<{ $active?: boolean }>`
  padding: 4px 8px;
  border-radius: var(--app-radius-s);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.$active ? 'var(--app-color-primary)' : 'var(--app-color-text-secondary)'};
  background: ${props => props.$active ? 'var(--app-color-surface)' : 'transparent'};
  box-shadow: ${props => props.$active ? 'var(--app-shadow-card)' : 'none'};
  transition: all 0.2s;

  &:active {
    opacity: 0.7;
  }
`;

const ReservationGrid = styled.div<{ $view?: 'card' | 'list' }>`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  ${props => props.$view === 'list' && css`
    grid-template-columns: 1fr;
    gap: 0;
    background: var(--app-color-surface);
    border-radius: var(--app-radius-m);
    overflow: hidden;
  `}
`;

const ListItem = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 12px;
  gap: 10px;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 12px;
    right: 12px;
    height: 1px;
    background: var(--app-color-border);
  }

  &:last-child::after {
    display: none;
  }
`;

const Dot = styled.div<{ $inHand?: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: var(--app-radius-avatar);
  background: ${props => props.$inHand ? 'var(--app-color-success)' : 'var(--app-color-placeholder)'};
  flex-shrink: 0;
`;

const ListItemName = styled.div`
  font-size: 14px;
  color: var(--app-color-text);
  flex: 1;
`;

const ReservationCard = styled.div`
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
  padding: 12px;
  position: relative;
`;

const CancelBtn = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border-radius: var(--app-radius-avatar);
  background: var(--app-color-danger);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--app-color-surface);
  font-size: 12px;
  line-height: 1;
`;

const ItemName = styled.div`
  font-size: 15px;
  font-weight: 500;
  margin-top: 4px;
  word-break: break-all;
`;

const ItemMeta = styled.div`
  font-size: 13px;
  color: var(--app-color-text-secondary);
  margin-bottom: 4px;

  &.in-hand {
    color: var(--app-color-success);
  }
`;

const TimeRange = styled.div`
  font-size: 12px;
  color: var(--app-color-text);
  font-weight: 500;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--app-color-border);
`;

const Footer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--app-color-surface);
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  box-shadow: var(--app-shadow-card);
  display: flex;
  gap: 12px;
`;

interface Reservation {
  reservation_id: number;
  reservation_item_id: number;
  reservation_start_time: number;
  reservation_end_time: number;
  reservation_is_canceled: boolean;
  item_name: string;
  item_qrcode: string;
  item_image?: string;
  box_name?: string;
  room_name?: string;
  is_user_box?: boolean;
  holder_nickname?: string;
  holder_user_id?: number;
}

interface OrderDetail {
  order: {
    order_id: number;
    order_create_time: number;
    order_title: string | null;
    order_is_canceled: boolean;
    order_user_id: number;
  };
  reservations: Reservation[];
}

export default function ReservationOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [extendLoading, setExtendLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  useEffect(() => {
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res: any = await reservationApi.getOrderDetail(parseInt(id, 10));
      setData(res.data);
    } catch (error) {
      console.error('Failed to load order detail:', error);
      Toast.show({ icon: 'fail', content: '加载失败' });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: number | string) => {
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    return new Date(ts).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCancelOrder = async () => {
    if (!data) return;

    const result = await Dialog.confirm({
      title: '取消整个订单',
      content: '确定要取消整个订单吗？这将取消该订单下所有物品的预约。',
    });

    if (result) {
      try {
        await reservationApi.cancelOrder(data.order.order_id);
        Toast.show({ icon: 'success', content: '订单已取消' });
        navigate(-1);
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '取消失败' });
      }
    }
  };

  const handleCancelReservation = async (reservationId: number, itemName: string) => {
    const result = await Dialog.confirm({
      title: '取消物品预约',
      content: `确定要取消「${itemName}」的预约吗？`,
    });

    if (result) {
      try {
        await reservationApi.cancel(reservationId);
        Toast.show({ icon: 'success', content: '已取消' });
        loadDetail();
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '取消失败' });
      }
    }
  };

  const handleEditTitle = async () => {
    const currentTitle = data?.order.order_title || '';

    const result = await Dialog.confirm({
      title: '修改订单标题',
      content: (
        <Input
          id="order-title-input"
          placeholder="请输入订单标题"
          defaultValue={currentTitle}
          maxLength={24}
          style={{ '--font-size': '16px' }}
        />
      ),
    });

    if (!result) return;

    const input = document.getElementById('order-title-input') as HTMLInputElement;
    const newTitle = input?.value?.trim();

    if (!newTitle) {
      Toast.show({ content: '标题不能为空' });
      return;
    }

    if (newTitle.length > 24) {
      Toast.show({ content: '标题最多24个字符' });
      return;
    }

    try {
      await reservationApi.updateOrderTitle(data!.order.order_id, newTitle);
      setData({
        ...data!,
        order: { ...data!.order, order_title: newTitle },
      });
      Toast.show({ icon: 'success', content: '标题修改成功' });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '修改失败' });
    }
  };

  const handleExtendOrder = async (newEndTime: Date) => {
    if (!data) return;
    const newEndTimeMs = newEndTime.getTime();

    const extendableReservations = data.reservations.filter(
      (r) => !r.reservation_is_canceled && r.reservation_end_time >= Date.now()
    );

    if (extendableReservations.length === 0) return;

    const currentMaxEndTime = Math.max(...extendableReservations.map((r) => r.reservation_end_time));

    if (newEndTimeMs <= currentMaxEndTime) {
      Toast.show({ content: '新的结束时间必须晚于当前最晚的结束时间' });
      return;
    }

    const formatTimeStr = (ts: number) =>
      new Date(ts).toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

    const result = await Dialog.confirm({
      title: '确认延长订单',
      content: `将延长所有还在预约状态中的物品的结束时间至 ${formatTimeStr(newEndTimeMs)}，确定吗？`,
    });

    if (!result) return;

    try {
      setExtendLoading(true);
      await reservationApi.extendOrder(data.order.order_id, newEndTimeMs);
      Toast.show({ icon: 'success', content: '订单已延长' });
      loadDetail();
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '延长失败' });
    } finally {
      setExtendLoading(false);
    }
  };

  const getReservationStatus = (r: Reservation) => {
    if (r.reservation_is_canceled) {
      return <Tag color="danger">已取消</Tag>;
    }
    const now = Date.now();
    if (r.reservation_end_time < now) {
      return <Tag color="default">已结束</Tag>;
    }
    if (r.reservation_start_time > now) {
      return <Tag color="primary">即将开始</Tag>;
    }
    return <Tag color="success">进行中</Tag>;
  };

  if (loading) {
    return (
      <Container>
        <Header>
          <BackButton onClick={() => navigate(-1)}>←</BackButton>
          <HeaderTitle>订单详情</HeaderTitle>
        </Header>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <SpinLoading />
        </div>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container>
        <Header>
          <BackButton onClick={() => navigate(-1)}>←</BackButton>
          <HeaderTitle>订单详情</HeaderTitle>
        </Header>
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--app-color-text-secondary)' }}>
          订单不存在
        </div>
      </Container>
    );
  }

  const activeReservations = data.reservations.filter((r) => !r.reservation_is_canceled);
  const extendableReservations = data.reservations.filter(
    (r) => !r.reservation_is_canceled && r.reservation_end_time >= Date.now()
  );
  const isOwner = user?.user_id === data.order.order_user_id;
  const canCancelOrder = isOwner && !data.order.order_is_canceled && activeReservations.length > 0;
  const canExtendOrder = isOwner && !data.order.order_is_canceled && extendableReservations.length > 0;
  const currentMaxEndTime = extendableReservations.length > 0
    ? Math.max(...extendableReservations.map((r) => r.reservation_end_time))
    : 0;

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>订单详情</HeaderTitle>
      </Header>

      <Content>
        <OrderInfo>
          <OrderTitleRow>
            <OrderTitle>
              {data.order.order_title || `预约单 #${data.order.order_id}`}
            </OrderTitle>
            {isOwner && (
              <EditIconButton onClick={handleEditTitle}>
                <EditIcon size={16} />
              </EditIconButton>
            )}
          </OrderTitleRow>
          <OrderMeta>
            物品数量：{activeReservations.length} / {data.reservations.length} 个
          </OrderMeta>
          <OrderMeta>
            创建时间：{formatTime(data.order.order_create_time)}
          </OrderMeta>
          {data.order.order_is_canceled && (
            <Tag color="danger" style={{ marginTop: 8 }}>订单已取消</Tag>
          )}
        </OrderInfo>

        <SectionTitle>
          预约物品
          <ViewToggle>
            <ViewToggleBtn $active={viewMode === 'card'} onClick={() => setViewMode('card')}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <rect x="3" y="3" width="8" height="8" rx="1.5" />
                <rect x="13" y="3" width="8" height="8" rx="1.5" />
                <rect x="3" y="13" width="8" height="8" rx="1.5" />
                <rect x="13" y="13" width="8" height="8" rx="1.5" />
              </svg>
            </ViewToggleBtn>
            <ViewToggleBtn $active={viewMode === 'list'} onClick={() => setViewMode('list')}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <rect x="3" y="4" width="18" height="3" rx="1" />
                <rect x="3" y="10.5" width="18" height="3" rx="1" />
                <rect x="3" y="17" width="18" height="3" rx="1" />
              </svg>
            </ViewToggleBtn>
          </ViewToggle>
        </SectionTitle>
        <ReservationGrid $view={viewMode}>
          {viewMode === 'card' ? (
            data.reservations.map((r) => (
              <ReservationCard key={r.reservation_id}>
                {getReservationStatus(r)}
                <ItemName>{r.item_name}</ItemName>
                <ItemMeta className={r.is_user_box && r.holder_user_id === user?.user_id ? 'in-hand' : ''}>
                  {r.is_user_box
                    ? r.holder_user_id === user?.user_id ? '在我手中' : `${r.holder_nickname || '未知用户'}手中`
                    : `${r.room_name || ''}${r.box_name ? ` / ${r.box_name}` : ''}`
                  }
                </ItemMeta>
                <TimeRange>
                  {formatTime(r.reservation_start_time)} ~ {formatTime(r.reservation_end_time)}
                </TimeRange>
                {isOwner && !r.reservation_is_canceled && (
                  <CancelBtn onClick={() => handleCancelReservation(r.reservation_id, r.item_name)}>✕</CancelBtn>
                )}
              </ReservationCard>
            ))
          ) : (
            data.reservations.map((r) => (
              <ListItem key={r.reservation_id}>
                <Dot $inHand={r.is_user_box && r.holder_user_id === user?.user_id} />
                <ListItemName>{r.item_name}</ListItemName>
              </ListItem>
            ))
          )}
        </ReservationGrid>
      </Content>

      {(canCancelOrder || canExtendOrder) && (
        <Footer>
          {canExtendOrder && (
            <DatePicker
              title="选择新的结束时间"
              onConfirm={(val) => handleExtendOrder(val)}
              min={new Date(currentMaxEndTime + 60000)}
              precision="minute"
            >
              {(_, { open }) => (
                <Button
                  block
                  color="primary"
                  fill="solid"
                  loading={extendLoading}
                  onClick={open}
                >
                  延长订单
                </Button>
              )}
            </DatePicker>
          )}
          {canCancelOrder && (
            <Button
              block
              color="danger"
              fill="solid"
              onClick={handleCancelOrder}
            >
              取消整个订单
            </Button>
          )}
        </Footer>
      )}
    </Container>
  );
}
