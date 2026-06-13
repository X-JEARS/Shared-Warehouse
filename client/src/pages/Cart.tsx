import { useNavigate } from 'react-router-dom';
import { Button, DatePicker, Dialog, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { reservationApi } from '../services/api';
import { useState } from 'react';
import TrashIcon from '../components/icons/TrashIcon';

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
  min-height: 100%;
  background: var(--app-color-bg);
`;

const Header = styled.div`
  background: var(--app-color-surface);
  padding: 8px 16px;
  border-bottom: 1px solid var(--app-color-border);
  display: flex;
  align-items: center;
`;

const BackButton = styled.div`
  font-size: 20px;
  margin-right: 12px;
  cursor: pointer;
  color: var(--app-color-text);
`;

const HeaderTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
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

const Content = styled.div`
  padding: 16px;
  padding-bottom: 180px;
`;

const TimeCard = styled.div`
  background: var(--app-color-surface);
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
    background: var(--app-color-bg);
  }
`;

const CartItem = styled.div`
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
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
  color: var(--app-color-text-secondary);
  margin-bottom: 4px;
`;

const Footer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--app-color-surface);
  padding: 12px 16px;
  display: flex;
  gap: 12px;
  box-shadow: 0 -2px 8px var(--app-shadow-card);
`;

const EmptyContainer = styled.div`
  text-align: center;
  padding: 60px 20px;
`;

export default function Cart() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const { items, startTime, endTime, setTime, removeItem, clearCart, orderTitle, setOrderTitle } = useCartStore();
  const [loading, setLoading] = useState(false);

  const dateStr = new Date().toLocaleDateString(i18n.language === 'en-US' ? 'en-US' : 'zh-CN', { month: '2-digit', day: '2-digit' }).replace(/\//g, '');
  const defaultTitle = t('cart.defaultTitle', { nickname: user?.user_nickname || 'User', date: dateStr });

  const handleEditTitle = async () => {
    const result = await Dialog.confirm({
      title: t('cart.editTitle'),
      content: <input
        id="order-title-input"
        defaultValue={orderTitle || ''}
        placeholder={t('cart.titlePlaceholder')}
        style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--app-color-border)', borderRadius: 'var(--app-radius-s)', fontSize: '14px', outline: 'none' }}
      />,
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
    });

    if (result) {
      const input = document.getElementById('order-title-input') as HTMLInputElement;
      const newTitle = input?.value?.trim() || '';
      setOrderTitle(newTitle || undefined);
    }
  };

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
        navigate('/in-hand');
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

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return t('cart.selectTime');
    return new Date(timestamp).toLocaleString(i18n.language === 'en-US' ? 'en-US' : 'zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitleRow>
          <HeaderTitle>{orderTitle || defaultTitle}</HeaderTitle>
          <EditIconButton onClick={handleEditTitle}>
            <EditIcon size={16} />
          </EditIconButton>
        </HeaderTitleRow>
      </Header>

      <Content>
        {items.length === 0 ? (
          <EmptyContainer>
            <p style={{ color: 'var(--app-color-text-secondary)', marginBottom: 16 }}>{t('cart.cartEmpty')}</p>
            <Button color="primary" onClick={() => navigate('/warehouse')}>
              {t('warehouse.addItem')}
            </Button>
          </EmptyContainer>
        ) : (
          <>
            <TimeCard>
              <TimeCardTitle>📅 {t('cart.reservationTime')}</TimeCardTitle>
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
                    {(value, { open }) => (
                      <TimeButton onClick={open}>
                        {value ? formatTime(value.getTime()) : t('cart.selectTime')}
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
                    {(value, { open }) => (
                      <TimeButton onClick={open}>
                        {value ? formatTime(value.getTime()) : t('cart.selectTime')}
                      </TimeButton>
                    )}
                  </DatePicker>
                </TimeField>
              </TimeSelector>
            </TimeCard>

            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--app-color-text-weak)', fontSize: 14 }}>{t('cart.totalItems', { count: items.length })}</span>
              <Button
                size="small"
                fill="outline"
                onClick={() => clearCart()}
              >
                {t('cart.clear')}
              </Button>
            </div>

            {items.map((item) => (
              <CartItem key={item.itemId}>
                <ItemHeader>
                  <ItemName>{item.itemName}</ItemName>
                  <TrashIcon
                    style={{ color: 'var(--app-color-danger)', cursor: 'pointer' }}
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
                {formatTime(startTime)} ~ {formatTime(endTime)}
              </span>
            ) : (
              <span style={{ color: 'var(--app-color-danger)' }}>{t('cart.setReservationTime')}</span>
            )}
          </div>
          <Button
            color="primary"
            loading={loading}
            onClick={handleCheckout}
            disabled={!startTime || !endTime}
          >
            {t('cart.confirmCheckout')}
          </Button>
        </Footer>
      )}
    </Container>
  );
}
