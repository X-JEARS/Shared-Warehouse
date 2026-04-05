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
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
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
      <Content>
        <Outlet />
      </Content>
      <TabBarContainer>
        <TabBar
          activeKey={pathname}
          onChange={(value) => navigate(value)}
        >
          {tabs.map((item) => (
            <TabBar.Item key={item.key} icon={item.icon} title={item.title} />
          ))}
        </TabBar>
      </TabBarContainer>
    </Container>
  );
}
