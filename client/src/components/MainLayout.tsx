import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppOutline,
  UnorderedListOutline,
  UserOutline,
  CalendarOutline,
  ScanCodeOutline,
} from 'antd-mobile-icons';
import styled from 'styled-components';
import { useEffect, useMemo, Fragment, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { useNotificationStore } from '../stores/notificationStore';
import { swrFetcher } from '../utils/swr';

const routePreloadMap: Record<string, () => Promise<any>> = {
  '/scanner': () => import('../pages/Scanner'),
  '/create-item': () => import('../pages/CreateItem'),
  '/create-room': () => import('../pages/CreateRoom'),
  '/join-room': () => import('../pages/JoinRoom'),
  '/my-items': () => import('../pages/MyItems'),
  '/my-profile': () => import('../pages/MyProfile'),
  '/my-reservations': () => import('../pages/MyReservations'),
  '/my-transfer-records': () => import('../pages/MyTransferRecords'),
  '/system-settings': () => import('../pages/SystemSettings'),
};

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--app-color-bg);

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
  background: var(--app-color-tab-bar-bg);
  border-top: 1px solid var(--app-color-tab-bar-border);
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
    border-right: 1px solid var(--app-color-tab-bar-border);
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
  border-radius: var(--app-radius-s);
  cursor: pointer;
  color: ${(props) => (props.$active ? 'var(--app-color-tab-bar-active)' : 'var(--app-color-tab-bar-inactive)')};
  background: ${(props) => (props.$active ? 'var(--app-color-info-bg)' : 'transparent')};
  transition: all 0.2s;

  &:hover {
    background: var(--app-color-hover);
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

const SideScanButton = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--app-color-scan-btn-bg);
  color: var(--app-color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  box-shadow: var(--app-shadow-tab);
  cursor: pointer;
  margin: 4px auto 8px;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.95);
  }
`;

const BadgeWrapper = styled.div`
  position: relative;
  display: inline-flex;
`;

const InHandBadge = styled.div`
  position: absolute;
  top: -2px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--app-color-badge-instock-text);
  color: var(--app-color-white);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  border-radius: 8px;
  z-index: 1;
`;

const MobileTabBar = styled.div`
  @media (min-width: 768px) {
    display: none;
  }
`;

const CustomTabBar = styled.div`
  display: flex;
  align-items: center;
  height: 50px;
  position: relative;
  background: var(--app-color-tab-bar-bg);
  padding: 0;
`;

const RegularTabItem = styled.div<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 6px 0;
  cursor: pointer;
  color: ${(props) => (props.$active ? 'var(--app-color-tab-bar-active)' : 'var(--app-color-tab-bar-inactive)')};
  transition: color 0.2s;

  &:active {
    opacity: 0.7;
  }
`;

const RegularTabIcon = styled.div`
  font-size: 22px;
  line-height: 1;
  position: relative;
`;

const RegularTabTitle = styled.div`
  font-size: 10px;
  line-height: 15px;
  margin-top: 2px;
`;

const ScanDome = styled.div`
  position: absolute;
  top: -19px;
  left: 50%;
  transform: translateX(-50%);
  width: 70px;
  height: 70px;
  background: var(--app-color-tab-bar-bg);
  border: 1px solid var(--app-color-tab-bar-border);
  border-radius: 50%;
  box-sizing: border-box;
  clip-path: inset(0 0 51px 0);
  z-index: 5;
`;

const ScanButton = styled.div`
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--app-color-scan-btn-bg);
  color: var(--app-color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  box-shadow: var(--app-shadow-fab);
  cursor: pointer;
  transition: transform 0.2s;
  z-index: 10;

  &:active {
    transform: translateX(-50%) scale(0.95);
  }
`;

const ScanPlaceholder = styled.div`
  flex: 1;
`;

const tabsConfig = [
  {
    key: '/scanner',
    titleKey: 'tabBar.scan',
    icon: <ScanCodeOutline />,
    type: 'scan',
  },
  {
    key: '/warehouse',
    titleKey: 'tabBar.warehouse',
    icon: <AppOutline />,
  },
  {
    key: '/reservation-orders',
    titleKey: 'tabBar.reservation',
    icon: <CalendarOutline />,
  },
  {
    key: '/in-hand',
    titleKey: 'tabBar.inHand',
    icon: <UnorderedListOutline />,
  },
  {
    key: '/profile',
    titleKey: 'tabBar.profile',
    icon: <UserOutline />,
  },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const { t } = useTranslation();
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);

  const tabs = useMemo(() => tabsConfig.map(tab => ({
    ...tab,
    title: t(tab.titleKey),
  })), [t]);

  const { data: inHandData } = useSWR('/items/in-hand/count', swrFetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  const inHandCount = inHandData?.count || 0;

  const preloadRoute = useCallback((path: string) => {
    const loader = routePreloadMap[path];
    if (loader) loader();
  }, []);

  const inHandIcon = inHandCount > 0
    ? <BadgeWrapper><UnorderedListOutline /><InHandBadge>{inHandCount > 99 ? '99+' : inHandCount}</InHandBadge></BadgeWrapper>
    : <UnorderedListOutline />;

  return (
    <Container>
      <TabBarContainer>
        {/* 移动端底部自定义 TabBar */}
        <MobileTabBar>
          <CustomTabBar>
            <ScanDome />
            <ScanButton onClick={() => navigate('/scanner')} onMouseEnter={() => preloadRoute('/scanner')} onFocus={() => preloadRoute('/scanner')}>
              <ScanCodeOutline />
            </ScanButton>
            {tabs.filter(t => t.type !== 'scan').map((item, index) => {
              const isActive = pathname === item.key;
              const icon = item.key === '/in-hand' ? inHandIcon : item.icon;
              return (
                <Fragment key={item.key}>
                  {index === 2 && <ScanPlaceholder />}
                  <RegularTabItem
                    $active={isActive}
                    onClick={() => navigate(item.key)}
                    onMouseEnter={() => preloadRoute(item.key)}
                    onFocus={() => preloadRoute(item.key)}
                  >
                    <RegularTabIcon>{icon}</RegularTabIcon>
                    <RegularTabTitle>{item.title}</RegularTabTitle>
                  </RegularTabItem>
                </Fragment>
              );
            })}
          </CustomTabBar>
        </MobileTabBar>

        {/* 桌面端侧边栏 */}
        <SideTabBar>
          <SideScanButton onClick={() => navigate('/scanner')} onMouseEnter={() => preloadRoute('/scanner')} onFocus={() => preloadRoute('/scanner')}>
            <ScanCodeOutline />
          </SideScanButton>
          {tabs.filter(t => t.type !== 'scan').map((item) => {
            const isActive = pathname === item.key;
            const icon = item.key === '/in-hand' ? inHandIcon : item.icon;
            return (
              <SideTabItem
                key={item.key}
                $active={isActive}
                onClick={() => navigate(item.key)}
                onMouseEnter={() => preloadRoute(item.key)}
                onFocus={() => preloadRoute(item.key)}
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