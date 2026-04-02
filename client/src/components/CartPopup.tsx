import { useState } from 'react';
import { Popup, Button, DatePicker, Dialog, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { useCartStore } from '../stores/cartStore';
import { reservationApi } from '../services/api';

const PopupContent = styled.div`
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
`;

const PopupHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const PopupTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
`;

const TimeCard = styled.div`
  background: #f9f9f9;
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
  border: 1px solid #f0f0f0;
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

const ItemCount = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
`;

const Footer = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
`;

const EmptyContainer = styled.div`
  text-align: center;
  padding: 40px 20px;
`;

interface CartPopupProps {
  visible: boolean;
  onClose: () => void;
}

export default function CartPopup({ visible, onClose }: CartPopupProps) {
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
        await reservationApi.createOrder({
          items: items.map((item) => ({
            itemId: item.itemId,
            startTime: startTime,
            endTime: endTime,
          })),
        });
        clearCart();
        Toast.show({ icon: 'success', content: '预约成功' });
        onClose();
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
    <Popup
      visible={visible}
      onMaskClick={onClose}
      bodyStyle={{ height: '80vh', borderRadius: '12px 12px 0 0' }}
    >
      <PopupContent>
        <PopupHeader>
          <PopupTitle>🛒 购物车</PopupTitle>
          {items.length > 0 && (
            <Button
              size="small"
              fill="outline"
              onClick={() => clearCart()}
            >
              清空
            </Button>
          )}
        </PopupHeader>

        {items.length === 0 ? (
          <EmptyContainer>
            <p style={{ color: '#999', marginBottom: 16 }}>购物车为空</p>
            <Button onClick={onClose}>继续浏览</Button>
          </EmptyContainer>
        ) : (
          <>
            <TimeCard>
              <TimeCardTitle>📅 预约时间</TimeCardTitle>
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
                    {(_, { open }) => (
                      <TimeButton onClick={open}>
                        {startTime ? formatTime(startTime) : '选择时间'}
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
                    {(_, { open }) => (
                      <TimeButton onClick={open}>
                        {endTime ? formatTime(endTime) : '选择时间'}
                      </TimeButton>
                    )}
                  </DatePicker>
                </TimeField>
              </TimeSelector>
            </TimeCard>

            <ItemCount>共 {items.length} 个物品</ItemCount>

            {items.map((item) => (
              <CartItem key={item.itemId}>
                <ItemHeader>
                  <ItemName>{item.itemName}</ItemName>
                  <span
                    style={{ color: '#ff4d4f', fontSize: 18, cursor: 'pointer' }}
                    onClick={() => removeItem(item.itemId)}
                  >
                    🗑️
                  </span>
                </ItemHeader>
                <ItemMeta>
                  {item.roomName}
                  {item.boxName && ` / ${item.boxName}`}
                </ItemMeta>
              </CartItem>
            ))}

            <Footer>
              <div style={{ flex: 1, fontSize: 14 }}>
                {startTime && endTime ? (
                  <span>
                    {formatTime(startTime)} ~ {formatTime(endTime)}
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
          </>
        )}
      </PopupContent>
    </Popup>
  );
}
