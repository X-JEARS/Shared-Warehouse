import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Tag, SpinLoading, Dialog, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { reservationApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

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
  margin-bottom: 12px;
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

const ReservationCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
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
  font-size: 13px;
  color: #666;
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
  const isOwner = user?.user_id === data.order.order_user_id;
  const canCancelOrder = isOwner && !data.order.order_is_canceled && activeReservations.length > 0;

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>订单详情</HeaderTitle>
      </Header>

      <Content>
        <OrderInfo>
          <OrderTitle>
            {data.order.order_title || `预约单 #${data.order.order_id}`}
          </OrderTitle>
          <OrderMeta>
            创建时间：{formatTime(data.order.order_create_time)}
          </OrderMeta>
          <OrderMeta>
            物品数量：{activeReservations.length} / {data.reservations.length} 个
          </OrderMeta>
          {data.order.order_is_canceled && (
            <Tag color="danger" style={{ marginTop: 8 }}>订单已取消</Tag>
          )}
        </OrderInfo>

        <SectionTitle>预约物品</SectionTitle>
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
              📅 {formatTime(r.reservation_start_time)} ~ {formatTime(r.reservation_end_time)}
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
      </Content>

      {canCancelOrder && (
        <Footer>
          <Button
            block
            color="danger"
            fill="outline"
            onClick={handleCancelOrder}
          >
            取消整个订单
          </Button>
        </Footer>
      )}
    </Container>
  );
}
