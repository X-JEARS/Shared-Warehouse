import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from 'antd-mobile';
import {
  InformationCircleOutline,
  BellOutline,
  SetOutline,
} from 'antd-mobile-icons';
import styled from 'styled-components';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';

const Container = styled.div`
  min-height: 100%;
  background: var(--app-color-bg);
`;

const Header = styled.div`
  background: var(--app-color-surface);
  padding: 24px 16px;
  text-align: center;
  margin-bottom: 12px;
  position: relative;
`;

const Avatar = styled.div<{ $avatar?: string }>`
  width: 80px;
  height: 80px;
  border-radius: var(--app-radius-avatar);
  background: ${(props) =>
    props.$avatar ? `url(${props.$avatar}) center/cover` : 'var(--app-color-avatar-default)'};
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-color-white);
  font-size: 32px;
`;

const Nickname = styled.span`
  font-size: 18px;
  font-weight: 600;
  color: var(--app-color-text);
  text-align: center;
`;

const LoginName = styled.div`
  font-size: 14px;
  color: var(--app-color-text-secondary);
  margin-top: 4px;
`;


const NotificationBell = styled.div`
  position: absolute;
  top: 16px;
  right: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 22px;
  color: var(--app-color-text);

  &:active {
    opacity: 0.7;
  }
`;

const NotificationBadge = styled.div`
  position: absolute;
  top: -2px;
  right: -6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--app-color-badge);
  color: var(--app-color-white);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  border-radius: var(--app-radius-m);
  z-index: 1;
`;

const Section = styled.div`
  background: var(--app-color-surface);
  margin-bottom: 12px;
`;


export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const avatarUrl = user?.user_avatar || undefined;

  useEffect(() => {
    fetchUnreadCount();
  }, []);

  return (
    <Container>
      <Header>
        <NotificationBell onClick={() => navigate('/notifications')}>
          <BellOutline />
          {unreadCount > 0 && (
            <NotificationBadge>
              {unreadCount > 99 ? '99+' : unreadCount}
            </NotificationBadge>
          )}
        </NotificationBell>
        <Avatar $avatar={avatarUrl}>
          {!avatarUrl && (user?.user_nickname?.charAt(0).toUpperCase() || 'U')}
        </Avatar>
        <Nickname>{user?.user_nickname || '未设置昵称'}</Nickname>
        <LoginName>@{user?.user_login_name}</LoginName>
      </Header>

      <Section>
        <MenuItem icon="👤" text="我的资料" onClick={() => navigate('/my-profile')} showBorder />
        <MenuItem icon="📦" text="我的物品" onClick={() => window.location.href = '/my-items'} showBorder />
        <MenuItem icon="📋" text="我的预约" onClick={() => navigate('/my-reservations')} showBorder />
        <MenuItem icon={<SetOutline fontSize={18} />} text="系统设置" onClick={() => navigate('/system-settings')} />
      </Section>

      <Section>
        <MenuItem
          icon={<InformationCircleOutline fontSize={18} />}
          text="关于"
          onClick={() =>
            Dialog.alert({
              title: '关于',
              content: '共享仓库 v1.0.0\n扫码借还，高效管理',
            })
          }
        />
      </Section>
    </Container>
  );
}

// Menu Item component
function MenuItem({
  icon,
  text,
  onClick,
  showBorder = false,
}: {
  icon: React.ReactNode | string;
  text: string;
  onClick: () => void;
  showBorder?: boolean;
}) {
  return (
    <div
      style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        borderBottom: showBorder ? '1px solid var(--app-color-border)' : 'none',
      }}
      onClick={onClick}
    >
      {typeof icon === 'string' ? (
        <span style={{ fontSize: 18, marginRight: 12 }}>{icon}</span>
      ) : (
        <span style={{ marginRight: 12 }}>{icon}</span>
      )}
      <span>{text}</span>
    </div>
  );
}