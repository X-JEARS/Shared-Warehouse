import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { TabBar } from 'antd-mobile';
import {
  AppOutline,
  UnorderedListOutline,
  MessageOutline,
  UserOutline,
  CalendarOutline,
} from 'antd-mobile-icons';
import styled from 'styled-components';
import { useEffect, useState } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { itemApi } from '../services/api';

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;

  @media (min-width: 768px) {
    flex-direction: row;
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-bottom: 50px;

  @media (min-width: 768px) {
    padding-bottom: 0;
    padding-left: 0;
  }
`;

const TabBarContainer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-top: 1px solid #eee;
  z-index: 1000;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow: visible;

  @media (min-width: 768px) {
    position: relative;
    bottom: auto;
    left: auto;
    right: auto;
    width: 56px;
    flex-shrink: 0;
    border-top: none;
    border-right: 1px solid #eee;
    padding-bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding-top: 8px;
  }
`;

const SideTabBar = styled.div`
  display: none;

  @media (min-width: 768px) {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 4px;
  }
`;

const SideTabItem = styled.div<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 2px;
  border-radius: 6px;
  cursor: pointer;
  color: ${(props) => (props.$active ? '#1677ff' : '#666')};
  background: ${(props) => (props.$active ? '#e6f4ff' : 'transparent')};
  transition: all 0.2s;

  &:hover {
    background: #f5f5f5;
  }

  &:active {
    transform: scale(0.95);
  }
`;

const SideTabIcon = styled.div`
  font-size: 20px;
  margin-bottom: 2px;
`;

const SideTabTitle = styled.div`
  font-size: 10px;
`;

const BadgeWrapper = styled.div`
  position: relative;
  display: inline-flex;
`;

const UnreadBadge = styled.div`
  position: absolute;
  top: -2px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: #ff3141;
  color: white;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  border-radius: 8px;
  z-index: 1;
`;

const InHandBadge = styled.div`
  position: absolute;
  top: -2px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: #52c41a;
  color: white;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  border-radius: 8px;
  z-index: 1;
`;

const MobileTabBar = styled.div`
  .adm-tab-bar-item-icon {
    overflow: visible;
  }

  @media (min-width: 768px) {
    display: none;
  }
`;

const tabs = [
  {
    key: '/warehouse',
    title: '仓库',
    icon: <AppOutline />,
  },
  {
    key: '/in-hand',
    title: '我手中的',
    icon: <UnorderedListOutline />,
  },
  {
    key: '/reservation-orders',
    title: '预约',
    icon: <CalendarOutline />,
  },
  {
    key: '/notifications',
    title: '通知',
    icon: 'notificationIcon',
  },
  {
    key: '/profile',
    title: '我的',
    icon: <UserOutline />,
  },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const [inHandCount, setInHandCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    itemApi.getInHandCount().then((res: any) => {
      setInHandCount(res.data?.count || 0);
    }).catch(() => {});
  }, [pathname]);

  const notificationIcon = unreadCount > 0
    ? <BadgeWrapper><MessageOutline /><UnreadBadge>{unreadCount > 99 ? '99+' : unreadCount}</UnreadBadge></BadgeWrapper>
    : <MessageOutline />;

  const inHandIcon = inHandCount > 0
    ? <BadgeWrapper><UnorderedListOutline /><InHandBadge>{inHandCount > 99 ? '99+' : inHandCount}</InHandBadge></BadgeWrapper>
    : <UnorderedListOutline />;

  return (
    <Container>
      <TabBarContainer>
        {/* 移动端底部 TabBar */}
        <MobileTabBar>
          <TabBar
            activeKey={pathname}
            onChange={(value) => navigate(value)}
          >
            {tabs.map((item) => (
              <TabBar.Item
                key={item.key}
                icon={item.key === '/notifications' ? notificationIcon : item.key === '/in-hand' ? inHandIcon : item.icon}
                title={item.title}
              />
            ))}
          </TabBar>
        </MobileTabBar>

        {/* 桌面端侧边栏 */}
        <SideTabBar>
          {tabs.map((item) => {
            const isActive = pathname === item.key;
            const icon = item.key === '/notifications' ? notificationIcon : item.key === '/in-hand' ? inHandIcon : item.icon;
            return (
              <SideTabItem
                key={item.key}
                $active={isActive}
                onClick={() => navigate(item.key)}
              >
                <SideTabIcon>{icon}</SideTabIcon>
                <SideTabTitle>{item.title}</SideTabTitle>
              </SideTabItem>
            );
          })}
        </SideTabBar>
      </TabBarContainer>
      <Content>
        <Outlet />
      </Content>
    </Container>
  );
}
