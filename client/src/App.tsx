import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, setDefaultConfig } from 'antd-mobile';
import zhCN from 'antd-mobile/es/locales/zh-CN';
import enUS from 'antd-mobile/es/locales/en-US';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { SpinLoading } from 'antd-mobile';
import Login from './pages/Login';
import Register from './pages/Register';
import MainLayout from './components/MainLayout';
import Warehouse from './pages/Warehouse';
import InHand from './pages/InHand';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';

const MyItems = lazy(() => import('./pages/MyItems'));
const RoomSettings = lazy(() => import('./pages/RoomSettings'));
const AddBox = lazy(() => import('./pages/AddBox'));
const BoxDetail = lazy(() => import('./pages/BoxDetail'));
const Scanner = lazy(() => import('./pages/Scanner'));
const CreateItem = lazy(() => import('./pages/CreateItem'));
const CreateRoom = lazy(() => import('./pages/CreateRoom'));
const JoinRoom = lazy(() => import('./pages/JoinRoom'));
const ReservationOrders = lazy(() => import('./pages/ReservationOrders'));
const ReservationOrderDetail = lazy(() => import('./pages/ReservationOrderDetail'));
const MyReservations = lazy(() => import('./pages/MyReservations'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const SystemSettings = lazy(() => import('./pages/SystemSettings'));
const MyTransferRecords = lazy(() => import('./pages/MyTransferRecords'));

function PageFallback() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      height: '100dvh', gap: 16, background: 'var(--app-color-bg)',
    }}>
      <img src="/icons/icon-192.png" alt="" style={{ width: 56, height: 56, borderRadius: 'var(--app-radius-m)' }} />
      <SpinLoading color="primary" />
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  const effectiveLanguage = useThemeStore((s) => s.effectiveLanguage);
  const locale = effectiveLanguage === 'en-US' ? enUS : zhCN;
  useEffect(() => {
    setDefaultConfig({ locale });
  }, [locale]);
  return (
    <ConfigProvider locale={locale}>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/warehouse" replace />} />
            <Route path="warehouse" element={<Warehouse />} />
            <Route path="in-hand" element={<InHand />} />
            <Route path="reservation-orders" element={<ReservationOrders />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route
            path="/room-settings/:id"
            element={
              <PrivateRoute>
                <RoomSettings />
              </PrivateRoute>
            }
          />
          <Route
            path="/add-box/:id"
            element={
              <PrivateRoute>
                <AddBox />
              </PrivateRoute>
            }
          />
          <Route
            path="/box/:id"
            element={
              <PrivateRoute>
                <BoxDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/scanner"
            element={
              <PrivateRoute>
                <Scanner />
              </PrivateRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <PrivateRoute>
                <Notifications />
              </PrivateRoute>
            }
          />
          <Route
            path="/create-item"
            element={
              <PrivateRoute>
                <CreateItem />
              </PrivateRoute>
            }
          />
          <Route
            path="/create-room"
            element={
              <PrivateRoute>
                <CreateRoom />
              </PrivateRoute>
            }
          />
          <Route
            path="/my-items"
            element={
              <PrivateRoute>
                <MyItems />
              </PrivateRoute>
            }
          />
          <Route
            path="/join-room"
            element={
              <PrivateRoute>
                <JoinRoom />
              </PrivateRoute>
            }
          />
          <Route
            path="/reservation-orders/:id"
            element={
              <PrivateRoute>
                <ReservationOrderDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/my-reservations"
            element={
              <PrivateRoute>
                <MyReservations />
              </PrivateRoute>
            }
          />
          <Route
            path="/my-profile"
            element={
              <PrivateRoute>
                <MyProfile />
              </PrivateRoute>
            }
          />
          <Route
            path="/system-settings"
            element={
              <PrivateRoute>
                <SystemSettings />
              </PrivateRoute>
            }
          />
          <Route
            path="/my-transfer-records"
            element={
              <PrivateRoute>
                <MyTransferRecords />
              </PrivateRoute>
            }
          />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
