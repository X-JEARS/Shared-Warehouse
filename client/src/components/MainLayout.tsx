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

const MobileTabBar = styled.div`
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
    icon: <MessageOutline />,
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
              <TabBar.Item key={item.key} icon={item.icon} title={item.title} />
            ))}
          </TabBar>
        </MobileTabBar>

        {/* 桌面端侧边栏 */}
        <SideTabBar>
          {tabs.map((item) => {
            const isActive = pathname === item.key;
            return (
              <SideTabItem
                key={item.key}
                $active={isActive}
                onClick={() => navigate(item.key)}
              >
                <SideTabIcon>{item.icon}</SideTabIcon>
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
