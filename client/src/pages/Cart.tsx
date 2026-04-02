import { useNavigate } from 'react-router-dom';
import { NavBar, Button, DatePicker, Dialog, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { useCartStore } from '../stores/cartStore';
import { reservationApi } from '../services/api';
import { useState } from 'react';
import TrashIcon from '../components/icons/TrashIcon';

const Container = styled.div`
  min-height: 100%;
  background: #f5f5f5;
`;

const Content = styled.div`
  padding: 16px;
  padding-bottom: 180px;
`;

const TimeCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
`;

const TimeCardTitle = styled.div`
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 12px;
`;

const TimeSelector = styled.div`
  display: flex;
  gap: 12px;
`;

const TimeField = styled.div`
  flex: 1;
`;

const TimeLabel = styled.div`
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
`;

const TimeButton = styled.div`
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  text-align: center;
  background: white;
  cursor: pointer;

  &:active {
    background: #f5f5f5;
  }
`;

const CartItem = styled.div`
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
`;

const ItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const ItemName = styled.div`
  font-size: 16px;
  font-weight: 500;
`;

const ItemMeta = styled.div`
  font-size: 13px;
  color: #999;
  margin-bottom: 4px;
`;

const Footer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  padding: 12px 16px;
  display: flex;
  gap: 12px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
`;

const EmptyContainer = styled.div`
  text-align: center;
  padding: 60px 20px;
`;

export default function Cart() {
  const navigate = useNavigate();
  const { items, startTime, endTime, setTime, removeItem, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!startTime || !endTime) {
      Toast.show({ content: '请设置预约时间' });
      return;
    }

    if (items.length === 0) {
      Toast.show({ content: '购物车为空' });
      return;
    }

    if (endTime <= startTime) {
      Toast.show({ content: '结束时间必须晚于开始时间' });
      return;
    }

    const result = await Dialog.confirm({
      title: '确认预约',
      content: `将预约 ${items.length} 个物品，确定吗？`,
    });

    if (result) {
      try {
        setLoading(true);
        // 使用批量创建订单的 API
        await reservationApi.createOrder({
          items: items.map((item) => ({
            itemId: item.itemId,
            startTime: startTime,
            endTime: endTime,
          })),
        });
        clearCart();
        Toast.show({ icon: 'success', content: '预约成功' });
        navigate('/in-hand');
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '预约失败' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSetTime = (type: 'start' | 'end', time: Date) => {
    if (type === 'start') {
      setTime(time.getTime(), endTime);
    } else {
      setTime(startTime, time.getTime());
    }
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '选择时间';
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Container>
      <NavBar onBack={() => navigate(-1)}>购物车</NavBar>

      <Content>
        {items.length === 0 ? (
          <EmptyContainer>
            <p style={{ color: '#999', marginBottom: 16 }}>购物车为空</p>
            <Button color="primary" onClick={() => navigate('/warehouse')}>
              去添加物品
            </Button>
          </EmptyContainer>
        ) : (
          <>
            {/* 统一时间设置 */}
            <TimeCard>
              <TimeCardTitle>📅 预约时间（适用于所有物品）</TimeCardTitle>
              <TimeSelector>
                <TimeField>
                  <TimeLabel>开始时间</TimeLabel>
                  <DatePicker
                    title="选择开始时间"
                    value={startTime ? new Date(startTime) : undefined}
                    onConfirm={(val) => handleSetTime('start', val)}
                    min={new Date()}
                    precision="minute"
                  >
                    {(value, { open }) => (
                      <TimeButton onClick={open}>
                        {value ? formatTime(value.getTime()) : '选择时间'}
                      </TimeButton>
                    )}
                  </DatePicker>
                </TimeField>
                <TimeField>
                  <TimeLabel>结束时间</TimeLabel>
                  <DatePicker
                    title="选择结束时间"
                    value={endTime ? new Date(endTime) : undefined}
                    onConfirm={(val) => handleSetTime('end', val)}
                    min={startTime ? new Date(startTime) : new Date()}
                    precision="minute"
                  >
                    {(value, { open }) => (
                      <TimeButton onClick={open}>
                        {value ? formatTime(value.getTime()) : '选择时间'}
                      </TimeButton>
                    )}
                  </DatePicker>
                </TimeField>
              </TimeSelector>
            </TimeCard>

            {/* 物品列表 */}
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#666', fontSize: 14 }}>共 {items.length} 个物品</span>
              <Button
                size="small"
                fill="outline"
                onClick={() => clearCart()}
              >
                清空购物车
              </Button>
            </div>

            {items.map((item) => (
              <CartItem key={item.itemId}>
                <ItemHeader>
                  <ItemName>{item.itemName}</ItemName>
                  <TrashIcon
                    style={{ color: '#ff4d4f', cursor: 'pointer' }}
                    onClick={() => removeItem(item.itemId)}
                  />
                </ItemHeader>
                <ItemMeta>
                  {item.roomName}
                  {item.boxName && ` / ${item.boxName}`}
                </ItemMeta>
              </CartItem>
            ))}
          </>
        )}
      </Content>

      {items.length > 0 && (
        <Footer>
          <div style={{ flex: 1, fontSize: 14 }}>
            {startTime && endTime ? (
              <span>
                预约时间：{formatTime(startTime)} ~ {formatTime(endTime)}
              </span>
            ) : (
              <span style={{ color: '#ff4d4f' }}>请设置预约时间</span>
            )}
          </div>
          <Button
            color="primary"
            loading={loading}
            onClick={handleCheckout}
            disabled={!startTime || !endTime}
          >
            确认预约
          </Button>
        </Footer>
      )}
    </Container>
  );
}
