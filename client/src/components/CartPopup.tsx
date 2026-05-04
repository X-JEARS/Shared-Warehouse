import { useState, useEffect, useCallback, useRef } from 'react';
import { Popup, Button, DatePicker, Dialog, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { useCartStore, ConflictingReservation } from '../stores/cartStore';
import { reservationApi } from '../services/api';
import TrashIcon from './icons/TrashIcon';

const PopupContent = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const ScrollContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  padding-bottom: 12px;
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

const CartGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
`;

const CartItem = styled.div`
  background: white;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ItemImage = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
`;

const ItemPlaceholder = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #999;
  flex-shrink: 0;
`;

const ItemInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ItemName = styled.div`
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ConflictBadge = styled.span`
  background: #fff2f0;
  color: #ff4d4f;
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 4px;
  font-weight: normal;
  flex-shrink: 0;
`;

const ItemCount = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
`;

const ConflictInfo = styled.div`
  background: #fff2f0;
  border-radius: 6px;
  padding: 10px;
  margin-top: 8px;
  font-size: 13px;
  color: #ff4d4f;
`;

const ConflictTime = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: #666;
`;

const Footer = styled.div`
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
  background: white;
  flex-shrink: 0;
`;

const EmptyContainer = styled.div`
  text-align: center;
  padding: 40px 20px;
`;

const ConflictWarning = styled.div`
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #d46b08;
  display: flex;
  align-items: center;
  gap: 8px;
`;

interface CartPopupProps {
  visible: boolean;
  onClose: () => void;
}

export default function CartPopup({ visible, onClose }: CartPopupProps) {
  const { items, startTime, endTime, setTime, removeItem, clearCart, updateConflict, clearConflicts } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  // 用 ref 存储最新的 items，避免 checkConflicts 依赖 items 导致无限循环
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // 格式化时间戳
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '选择时间';
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化冲突时间段
  const formatConflictTime = (reservation: ConflictingReservation) => {
    // 处理可能是字符串或数字的时间戳
    const startMs = typeof reservation.startTime === 'string' ? parseInt(reservation.startTime, 10) : reservation.startTime;
    const endMs = typeof reservation.endTime === 'string' ? parseInt(reservation.endTime, 10) : reservation.endTime;

    if (isNaN(startMs) || isNaN(endMs)) {
      return '时间信息无效';
    }

    const start = new Date(startMs);
    const end = new Date(endMs);
    return `${start.toLocaleDateString('zh-CN')} ${start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} ~ ${end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // 检查冲突 - 使用 ref 避免无限循环
  const checkConflicts = useCallback(async (currentTimeStart: number, currentTimeEnd: number) => {
    const currentItems = itemsRef.current;
    if (!currentTimeStart || !currentTimeEnd || currentItems.length === 0) {
      clearConflicts();
      return;
    }

    setCheckingConflicts(true);
    try {
      const itemIds = currentItems.map(item => item.itemId);
      const result = await reservationApi.checkConflicts({
        itemIds,
        startTime: currentTimeStart,
        endTime: currentTimeEnd,
      });

      // 先清除所有冲突信息
      clearConflicts();

      // 更新有冲突的物品
      const conflicts = (result as any).data || result;
      if (Array.isArray(conflicts)) {
        for (const conflict of conflicts) {
          updateConflict(conflict.itemId, {
            hasConflict: true,
            conflictingReservations: conflict.conflictingReservations,
          });
        }
      }
    } catch (error) {
      console.error('检查冲突失败:', error);
    } finally {
      setCheckingConflicts(false);
    }
  }, [clearConflicts, updateConflict]);

  // 当时间或物品数量变化时检查冲突（使用 debounce 避免频繁请求）
  useEffect(() => {
    if (visible && startTime && endTime && items.length > 0) {
      const timer = setTimeout(() => {
        checkConflicts(startTime, endTime);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, startTime, endTime, items.length, checkConflicts]);

  // 关闭时清除冲突检查
  useEffect(() => {
    if (!visible) {
      clearConflicts();
    }
  }, [visible, clearConflicts]);

  // 获取有冲突的物品数量
  const conflictedItems = items.filter(item => item.hasConflict);
  const hasConflicts = conflictedItems.length > 0;

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

    if (hasConflicts) {
      Toast.show({ content: '存在时间冲突的物品，请调整预约时间' });
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

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      bodyStyle={{ height: '80vh', borderRadius: '12px 12px 0 0' }}
    >
      <PopupContent>
        <ScrollContent>
          <PopupHeader>
            <PopupTitle>&ensp;购物车</PopupTitle>
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

              {hasConflicts && startTime && endTime && (
                <ConflictWarning>
                  ⚠️ {conflictedItems.length} 个物品在所选时间段存在冲突
                </ConflictWarning>
              )}

              <ItemCount>共 {items.length} 个物品</ItemCount>

              <CartGrid>
                {items.map((item) => (
                  <CartItem key={item.itemId}>
                    {item.itemImage
                      ? <ItemImage src={item.itemImage} alt={item.itemName} />
                      : <ItemPlaceholder>{item.itemName[0]}</ItemPlaceholder>
                    }
                    <ItemInfo>
                      <ItemName>
                        {item.itemName}
                        {item.hasConflict && <ConflictBadge>冲突</ConflictBadge>}
                      </ItemName>
                    </ItemInfo>
                    <TrashIcon
                      style={{ color: '#ff4d4f', cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => removeItem(item.itemId)}
                    />
                  </CartItem>
                ))}
              </CartGrid>

              {items.filter(item => item.hasConflict && item.conflictingReservations && item.conflictingReservations.length > 0).map((item) => (
                <ConflictInfo key={`conflict-${item.itemId}`}>
                  <div>{item.itemName} 已被 {item.conflictingReservations!.length > 0 ? item.conflictingReservations![0].userNickname : ''} 预约：</div>
                  {item.conflictingReservations!.map((res) => (
                    <ConflictTime key={res.reservationId}>
                      • {formatConflictTime(res)}
                    </ConflictTime>
                  ))}
                </ConflictInfo>
              ))}
            </>
          )}
        </ScrollContent>

        {items.length > 0 && (
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
              loading={loading || checkingConflicts}
              onClick={handleCheckout}
              disabled={!startTime || !endTime || hasConflicts}
            >
              确认预约
            </Button>
          </Footer>
        )}
      </PopupContent>
    </Popup>
  );
}
