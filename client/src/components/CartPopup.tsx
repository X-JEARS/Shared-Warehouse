import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Popup, Button, DatePicker, Dialog, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { useCartStore, ConflictingReservation } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { reservationApi } from '../services/api';
import TrashIcon from './icons/TrashIcon';

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

const PopupTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PopupTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
`;

const EditIconButton = styled.button`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--app-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    opacity: 0.8;
  }
`;

const TimeCard = styled.div`
  background: var(--app-color-hover);
  border-radius: var(--app-radius-m);
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
  color: var(--app-color-text-weak);
  margin-bottom: 8px;
`;

const TimeButton = styled.div`
  padding: 8px 12px;
  border: 1px solid var(--app-color-border);
  border-radius: var(--app-radius-s);
  font-size: 14px;
  text-align: center;
  background: var(--app-color-surface);
  cursor: pointer;

  &:active {
    background: var(--app-color-hover);
  }
`;

const CartGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
`;

const CartItem = styled.div`
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
  padding: 12px;
  border: 1px solid var(--app-color-border);
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
  border-radius: var(--app-radius-s);
  background: var(--app-color-img-placeholder);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--app-color-text-secondary);
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
  background: var(--app-color-danger-bg);
  color: var(--app-color-danger);
  font-size: 11px;
  padding: 1px 4px;
  border-radius: var(--app-radius-s);
  font-weight: normal;
  flex-shrink: 0;
`;

const ItemCount = styled.div`
  font-size: 14px;
  color: var(--app-color-text-weak);
  margin-bottom: 12px;
`;

const ConflictInfo = styled.div`
  background: var(--app-color-danger-bg);
  border-radius: var(--app-radius-s);
  padding: 10px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--app-color-danger);
`;

const ConflictTime = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: var(--app-color-text-weak);
`;

const Footer = styled.div`
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--app-color-border);
  background: var(--app-color-surface);
  flex-shrink: 0;
`;

const EmptyContainer = styled.div`
  text-align: center;
  padding: 40px 20px;
`;

const ConflictWarning = styled.div`
  background: var(--app-color-warning-bg);
  border: 1px solid var(--app-color-warning-border);
  border-radius: var(--app-radius-m);
  padding: 12px;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--app-color-warning-text);
  display: flex;
  align-items: center;
  gap: 8px;
`;

interface CartPopupProps {
  visible: boolean;
  onClose: () => void;
}

export default function CartPopup({ visible, onClose }: CartPopupProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const items = useCartStore((s) => s.items);
  const startTime = useCartStore((s) => s.startTime);
  const endTime = useCartStore((s) => s.endTime);
  const orderTitle = useCartStore((s) => s.orderTitle);
  const setTime = useCartStore((s) => s.setTime);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const setOrderTitle = useCartStore((s) => s.setOrderTitle);
  const updateConflict = useCartStore((s) => s.updateConflict);
  const clearConflicts = useCartStore((s) => s.clearConflicts);
  const [loading, setLoading] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  const locale = i18n.language === 'en-US' ? 'en-US' : 'zh-CN';

  const defaultTitle = useMemo(() => {
    const dateStr = new Date().toLocaleDateString(locale, { month: '2-digit', day: '2-digit' }).replace('/', '');
    return t('cart.defaultTitle', { nickname: user?.user_nickname || 'User', date: dateStr });
  }, [locale, user?.user_nickname, t]);

  const handleEditTitle = async () => {
    let editedTitle = orderTitle || '';
    const result = await Dialog.confirm({
      title: t('cart.editTitle'),
      content: <input
        defaultValue={editedTitle}
        onChange={(e) => { editedTitle = e.target.value; }}
        placeholder={t('cart.titlePlaceholder')}
        style={{ width: '100%', padding: '8px 12px', border: `1px solid var(--app-color-border)`, borderRadius: '4px', fontSize: '14px', outline: 'none' }}
      />,
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
    });

    if (result) {
      const newTitle = editedTitle.trim();
      setOrderTitle(newTitle || undefined);
    }
  };

  // 用 ref 存储最新的 items，避免 checkConflicts 依赖 items 导致无限循环
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // 格式化时间戳
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return t('cart.selectTime');
    return new Date(timestamp).toLocaleString(locale, {
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
      return t('cart.invalidTime');
    }

    const start = new Date(startMs);
    const end = new Date(endMs);
    return `${start.toLocaleDateString(locale)} ${start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} ~ ${end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
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
      Toast.show({ content: t('cart.setReservationTime') });
      return;
    }

    if (items.length === 0) {
      Toast.show({ content: t('cart.cartEmpty') });
      return;
    }

    if (endTime <= startTime) {
      Toast.show({ content: t('cart.endTimeAfterStart') });
      return;
    }

    if (hasConflicts) {
      Toast.show({ content: t('cart.conflictItemsExist') });
      return;
    }

    const result = await Dialog.confirm({
      title: t('cart.confirmReservation'),
      content: t('cart.confirmReservationContent', { count: items.length }),
    });

    if (result) {
      try {
        setLoading(true);
        await reservationApi.createOrder({
          title: orderTitle || defaultTitle,
          items: items.map((item) => ({
            itemId: item.itemId,
            startTime: startTime,
            endTime: endTime,
          })),
        });
        clearCart();
        Toast.show({ icon: 'success', content: t('cart.reservationSuccess') });
        onClose();
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || t('cart.reservationFailed') });
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
            <PopupTitleRow>
              <PopupTitle>{orderTitle || defaultTitle}</PopupTitle>
              <EditIconButton onClick={handleEditTitle}>
                <EditIcon size={16} />
              </EditIconButton>
            </PopupTitleRow>
            {items.length > 0 && (
              <Button
                size="small"
                fill="outline"
                onClick={() => clearCart()}
              >
                {t('cart.clear')}
              </Button>
            )}
          </PopupHeader>

          {items.length === 0 ? (
            <EmptyContainer>
              <p style={{ color: 'var(--app-color-text-secondary)', marginBottom: 16 }}>{t('cart.cartEmpty')}</p>
              <Button onClick={onClose}>{t('cart.continueBrowse')}</Button>
            </EmptyContainer>
          ) : (
            <>
              <TimeCard>
                <TimeCardTitle>{t('cart.reservationTime')}</TimeCardTitle>
                <TimeSelector>
                  <TimeField>
                    <TimeLabel>{t('cart.startTime')}</TimeLabel>
                    <DatePicker
                      title={t('cart.selectStartTime')}
                      value={startTime ? new Date(startTime) : undefined}
                      onConfirm={(val) => handleSetTime('start', val)}
                      min={new Date()}
                      precision="minute"
                    >
                      {(_, { open }) => (
                        <TimeButton onClick={open}>
                          {startTime ? formatTime(startTime) : t('cart.selectTime')}
                        </TimeButton>
                      )}
                    </DatePicker>
                  </TimeField>
                  <TimeField>
                    <TimeLabel>{t('cart.endTime')}</TimeLabel>
                    <DatePicker
                      title={t('cart.selectEndTime')}
                      value={endTime ? new Date(endTime) : undefined}
                      onConfirm={(val) => handleSetTime('end', val)}
                      min={startTime ? new Date(startTime) : new Date()}
                      precision="minute"
                    >
                      {(_, { open }) => (
                        <TimeButton onClick={open}>
                          {endTime ? formatTime(endTime) : t('cart.selectTime')}
                        </TimeButton>
                      )}
                    </DatePicker>
                  </TimeField>
                </TimeSelector>
              </TimeCard>

              {hasConflicts && startTime && endTime && (
                <ConflictWarning>
                  ⚠️ {t('cart.conflictCount', { count: conflictedItems.length })}
                </ConflictWarning>
              )}

              <ItemCount>{t('cart.totalItems', { count: items.length })}</ItemCount>

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
                        {item.hasConflict && <ConflictBadge>{t('cart.conflict')}</ConflictBadge>}
                      </ItemName>
                    </ItemInfo>
                    <TrashIcon
                      style={{ color: 'var(--app-color-danger)', cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => removeItem(item.itemId)}
                    />
                  </CartItem>
                ))}
              </CartGrid>

              {items.filter(item => item.hasConflict && item.conflictingReservations && item.conflictingReservations.length > 0).map((item) => (
                <ConflictInfo key={`conflict-${item.itemId}`}>
                  <div>{t('cart.conflictInfo', {
                    itemName: item.itemName,
                    userName: item.conflictingReservations!.length > 0 ? item.conflictingReservations![0].userNickname : '',
                  })}</div>
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
                <span style={{ color: 'var(--app-color-danger)' }}>{t('cart.setReservationTime')}</span>
              )}
            </div>
            <Button
              color="primary"
              loading={loading || checkingConflicts}
              onClick={handleCheckout}
              disabled={!startTime || !endTime || hasConflicts}
            >
              {t('cart.confirmCheckout')}
            </Button>
          </Footer>
        )}
      </PopupContent>
    </Popup>
  );
}
