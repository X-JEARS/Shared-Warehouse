import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Empty, Badge } from 'antd-mobile';
import { ListSkeleton } from '../components/skeleton';
import { useMinLoadingTime } from '../hooks/useMinLoadingTime';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { notificationApi } from '../services/api';
import { useNotificationStore } from '../stores/notificationStore';

const Container = styled.div`
  min-height: 100%;
  background: var(--app-color-surface);
`;

const Header = styled.div`
  position: sticky;
  top: 0;
  z-index: 100;
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

const NotificationItem = styled.div<{ $isRead: boolean }>`
  padding: 16px;
  border-bottom: 1px solid var(--app-color-border);
  background: ${(props) => (props.$isRead ? 'var(--app-color-surface)' : 'var(--app-color-info-bg)')};
`;

const NotificationTitle = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: var(--app-color-text);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const NotificationContent = styled.div`
  font-size: 13px;
  color: var(--app-color-text-weak);
  margin-bottom: 4px;
`;

const NotificationTime = styled.div`
  font-size: 12px;
  color: var(--app-color-text-secondary);
`;

interface Notification {
  notification_id: number;
  notification_type: string;
  notification_title: string;
  notification_content?: string;
  notification_is_read: boolean;
  notification_create_time: number;
}

export default function Notifications() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { unreadCount, setUnreadCount, decrement, reset } = useNotificationStore();

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res: any = await notificationApi.getAll();
      setNotifications(res.data?.items || []);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === id ? { ...n, notification_is_read: true } : n
        )
      );
      decrement();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, notification_is_read: true }))
      );
      reset();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const formatTime = (timestamp: number | string) => {
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    if (!ts || isNaN(ts)) return t('common.unknownTime');
    const date = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return t('notifications.minutesAgo', { count: minutes });
      }
      return t('notifications.hoursAgo', { count: hours });
    } else if (days === 1) {
      return t('notifications.yesterday');
    } else if (days < 7) {
      return t('notifications.daysAgo', { count: days });
    }
    return date.toLocaleDateString(i18n.language === 'en-US' ? 'en-US' : 'zh-CN');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'borrow':
        return '📤';
      case 'return':
        return '📥';
      case 'reserve':
        return '📅';
      case 'comment':
        return '💬';
      default:
        return '🔔';
    }
  };

  const showSkeleton = useMinLoadingTime(loading);

  if (showSkeleton) {
    return (
      <Container>
        <Header>
          <BackButton onClick={() => navigate(-1)}>←</BackButton>
          <HeaderTitle>{t('notifications.title')}</HeaderTitle>
        </Header>
        <div style={{ padding: 16 }}>
          <ListSkeleton count={8} />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>{t('notifications.title')}</HeaderTitle>
      </Header>
      {unreadCount > 0 && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--app-color-bg)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 14, color: 'var(--app-color-text-weak)' }}>
            {t('notifications.unreadCount', { count: unreadCount })}
          </span>
          <span
            style={{ color: 'var(--app-color-primary)', fontSize: 14, cursor: 'pointer' }}
            onClick={markAllAsRead}
          >
            {t('notifications.markAllRead')}
          </span>
        </div>
      )}

      {notifications.length === 0 ? (
        <Empty description={t('notifications.noNotifications')} style={{ padding: 40 }} />
      ) : (
        notifications.map((n) => (
          <NotificationItem
            key={n.notification_id}
            $isRead={n.notification_is_read}
            onClick={() => !n.notification_is_read && markAsRead(n.notification_id)}
          >
            <NotificationTitle>
              <span>{getTypeIcon(n.notification_type)}</span>
              {n.notification_title}
              {!n.notification_is_read && <Badge />}
            </NotificationTitle>
            {n.notification_content && (
              <NotificationContent>{n.notification_content}</NotificationContent>
            )}
            <NotificationTime>{formatTime(n.notification_create_time)}</NotificationTime>
          </NotificationItem>
        ))
      )}
    </Container>
  );
}
