import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Tag, SpinLoading, Dialog, Toast, DatePicker, Input } from 'antd-mobile';
import styled from 'styled-components';
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
  background: #f5f5f5;
`;

const Header = styled.div`
  background: white;
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
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
  background: white;
  border-radius: 8px;
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
  color: #1677ff;
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
  color: #666;
  margin-bottom: 8px;
`;

const SectionTitle = styled.div`
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 12px;
  color: #333;
`;

const ReservationGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
`;

const ReservationCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 12px;
`;

const ReservationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const ItemName = styled.div`
  font-size: 15px;
  font-weight: 500;
`;

const ItemMeta = styled.div`
  font-size: 13px;
  color: #999;
  margin-bottom: 4px;
`;

const TimeRange = styled.div`
  font-size: 12px;
  color: #333;
  font-weight: 500;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
`;

const Footer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  padding: 12px 16px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
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
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
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

        <SectionTitle>预约物品</SectionTitle>
        <ReservationGrid>
          {data.reservations.map((r) => (
            <ReservationCard key={r.reservation_id}>
              <ReservationHeader>
                <ItemName>{r.item_name}</ItemName>
                {getReservationStatus(r)}
              </ReservationHeader>
              <ItemMeta>
                {r.room_name}
                {r.box_name && ` / ${r.box_name}`}
              </ItemMeta>
              <TimeRange>
                {formatTime(r.reservation_start_time)} ~ {formatTime(r.reservation_end_time)}
              </TimeRange>
              {isOwner && !r.reservation_is_canceled && (
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <Button
                    size="mini"
                    fill="outline"
                    color="danger"
                    onClick={() => handleCancelReservation(r.reservation_id, r.item_name)}
                  >
                    取消此预约
                  </Button>
                </div>
              )}
            </ReservationCard>
          ))}
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
                  fill="outline"
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
              fill="outline"
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
