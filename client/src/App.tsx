import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import MainLayout from './components/MainLayout';
import Warehouse from './pages/Warehouse';
import InHand from './pages/InHand';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import MyItems from './pages/MyItems';
import RoomSettings from './pages/RoomSettings';
import AddBox from './pages/AddBox';
import BoxDetail from './pages/BoxDetail';
import Cart from './pages/Cart';
import Scanner from './pages/Scanner';
import CreateItem from './pages/CreateItem';
import CreateRoom from './pages/CreateRoom';
import JoinRoom from './pages/JoinRoom';
import ReservationOrders from './pages/ReservationOrders';
import ReservationOrderDetail from './pages/ReservationOrderDetail';
import MyReservations from './pages/MyReservations';
import MyProfile from './pages/MyProfile';
import SystemSettings from './pages/SystemSettings';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
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
          path="/cart"
          element={
            <PrivateRoute>
              <Cart />
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
