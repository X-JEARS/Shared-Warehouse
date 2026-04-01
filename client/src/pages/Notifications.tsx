import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Empty, SpinLoading, Badge } from 'antd-mobile';
import styled from 'styled-components';
import { notificationApi } from '../services/api';

const Container = styled.div`
  min-height: 100%;
  background: white;
`;

const ActionButton = styled.div`
  background: white;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;

  &:active {
    background: #f5f5f5;
  }
`;

const ActionContent = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ActionIcon = styled.div`
  font-size: 24px;
`;

const ActionText = styled.div`
  font-size: 15px;
  font-weight: 500;
`;

const ActionDesc = styled.div`
  font-size: 12px;
  color: #999;
  margin-top: 2px;
`;

const NotificationItem = styled.div<{ $isRead: boolean }>`
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  background: ${(props) => (props.$isRead ? 'white' : '#f0f7ff')};
`;

const NotificationTitle = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const NotificationContent = styled.div`
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
`;

const NotificationTime = styled.div`
  font-size: 12px;
  color: #999;
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

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
      setUnreadCount((prev) => Math.max(0, prev - 1));
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
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const formatTime = (timestamp: number | string) => {
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    if (!ts || isNaN(ts)) return '未知时间';
    const date = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return `${minutes}分钟前`;
      }
      return `${hours}小时前`;
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    }
    return date.toLocaleDateString('zh-CN');
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

  if (loading) {
    return (
      <Container style={{ textAlign: 'center', paddingTop: 60 }}>
        <SpinLoading />
      </Container>
    );
  }

  return (
    <Container>
      {/* 预约订单入口 */}
      <ActionButton onClick={() => navigate('/reservation-orders')}>
        <ActionContent>
          <ActionIcon>📅</ActionIcon>
          <div>
            <ActionText>预约订单</ActionText>
            <ActionDesc>查看和管理您的预约</ActionDesc>
          </div>
        </ActionContent>
        <span style={{ color: '#999' }}>›</span>
      </ActionButton>

      {/* 通知列表 */}
      {unreadCount > 0 && (
        <div
          style={{
            padding: '12px 16px',
            background: '#f5f5f5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 14, color: '#666' }}>
            {unreadCount} 条未读消息
          </span>
          <span
            style={{ color: '#1677ff', fontSize: 14, cursor: 'pointer' }}
            onClick={markAllAsRead}
          >
            全部已读
          </span>
        </div>
      )}

      {notifications.length === 0 ? (
        <Empty description="暂无通知" style={{ padding: 40 }} />
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
