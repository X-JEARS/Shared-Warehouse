import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, SearchBar, SpinLoading, Dropdown } from 'antd-mobile';
import { AddOutline, ScanCodeOutline } from 'antd-mobile-icons';
import styled from 'styled-components';
import { useRoomStore } from '../stores/roomStore';
import { useCartStore } from '../stores/cartStore';
import { itemApi, roomApi } from '../services/api';
import WarehouseSelector from '../components/WarehouseSelector';
import FilterBar from '../components/FilterBar';
import ItemCard from '../components/ItemCard';
import ItemDetail from '../components/ItemDetail';

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  background: white;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f0f0f0;
`;

const SearchContainer = styled.div`
  padding: 12px 16px;
  background: white;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
`;

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const FAB = styled.div`
  position: fixed;
  right: 16px;
  bottom: 80px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 100;
`;

const FABButton = styled.div<{ $primary?: boolean }>`
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${(props) => (props.$primary ? '#1677ff' : '#52c41a')};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.95);
  }
`;

const NoRoomContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
`;

const NoRoomTitle = styled.h3`
  font-size: 18px;
  color: #333;
  margin-bottom: 8px;
`;

const NoRoomText = styled.p`
  font-size: 14px;
  color: #999;
  margin-bottom: 24px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
`;

export default function Warehouse() {
  const navigate = useNavigate();
  const { currentRoom, rooms, setRooms, setCurrentRoom } = useRoomStore();
  const { items: cartItems } = useCartStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState<{ boxId?: number; tagId?: number }>({});
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // 加载仓库列表
  useEffect(() => {
    const loadRooms = async () => {
      try {
        setRoomsLoading(true);
        const res: any = await roomApi.getAll();
        setRooms(res.data || []);
        if (res.data?.length > 0 && !currentRoom) {
          setCurrentRoom(res.data[0]);
        }
      } catch (error) {
        console.error('Failed to load rooms:', error);
      } finally {
        setRoomsLoading(false);
      }
    };
    loadRooms();
  }, []);

  useEffect(() => {
    if (currentRoom) {
      loadItems();
    }
  }, [currentRoom, filters]);

  const loadItems = async () => {
    if (!currentRoom) return;

    try {
      setLoading(true);
      const res: any = await itemApi.getAll({
        roomId: currentRoom.room_id,
        ...filters,
        search: searchText || undefined,
      });
      setItems(res.data || []);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadItems();
  };

  const handleFilterChange = (newFilters: { boxId?: number; tagId?: number }) => {
    setFilters(newFilters);
  };

  const handleItemClick = (itemId: number) => {
    setSelectedItem(itemId);
    setDetailVisible(true);
  };

  // 加载中
  if (roomsLoading) {
    return (
      <Container>
        <Header>
          <div style={{ fontSize: 16, fontWeight: 500 }}>仓库</div>
        </Header>
        <Content>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <SpinLoading />
          </div>
        </Content>
      </Container>
    );
  }

  // 没有仓库时的提示
  if (rooms.length === 0) {
    return (
      <Container>
        <Header>
          <div style={{ fontSize: 16, fontWeight: 500 }}>仓库</div>
        </Header>
        <Content>
          <NoRoomContainer>
            <NoRoomTitle>欢迎使用固定资产管理系统</NoRoomTitle>
            <NoRoomText>您还没有加入任何仓库，请创建或加入一个仓库开始使用</NoRoomText>
            <ActionButtons>
              <Button color="primary" onClick={() => navigate('/create-room')}>
                创建仓库
              </Button>
              <Button onClick={() => navigate('/join-room')}>
                加入仓库
              </Button>
            </ActionButtons>
          </NoRoomContainer>
        </Content>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WarehouseSelector />
          {currentRoom && currentRoom.room_admin && (
            <Button
              size="small"
              onClick={() => navigate(`/room-settings/${currentRoom.room_id}`)}
            >
              设置
            </Button>
          )}
        </div>
        <Dropdown>
          <Dropdown.Item key="actions" title={<span style={{ fontSize: 20 }}>⋯</span>}>
            <div style={{ padding: '12px 16px' }}>
              <div
                onClick={() => navigate('/create-room')}
                style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}
              >
                创建仓库
              </div>
              <div
                onClick={() => navigate('/join-room')}
                style={{ padding: '12px 0' }}
              >
                加入仓库
              </div>
            </div>
          </Dropdown.Item>
        </Dropdown>
      </Header>

      {currentRoom && (
        <SearchContainer>
          <SearchBar
            value={searchText}
            onChange={setSearchText}
            placeholder="搜索物品..."
            onSearch={handleSearch}
            showCancelButton
          />
        </SearchContainer>
      )}

      {currentRoom && (
        <FilterBar
          roomId={currentRoom.room_id}
          onFilterChange={handleFilterChange}
        />
      )}

      <Content>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <SpinLoading />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: '#999', marginBottom: 16 }}>当前仓库暂无物品</p>
            <Button color="primary" onClick={() => navigate('/create-item')}>
              添加物品
            </Button>
          </div>
        ) : (
          <ItemList>
            {items.map((item) => (
              <ItemCard
                key={item.item_id}
                item={item}
                onClick={() => handleItemClick(item.item_id)}
              />
            ))}
          </ItemList>
        )}
      </Content>

      <FAB>
        {currentRoom && (
          <FABButton $primary onClick={() => navigate('/create-item')}>
            <AddOutline />
          </FABButton>
        )}
        <FABButton onClick={() => navigate('/scanner')}>
          <ScanCodeOutline />
        </FABButton>
        <FABButton onClick={() => navigate('/cart')}>
          🛒
          {cartItems.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: '#ff4d4f',
                color: 'white',
                fontSize: 12,
                borderRadius: '50%',
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {cartItems.length}
            </span>
          )}
        </FABButton>
      </FAB>

      <ItemDetail
        visible={detailVisible}
        itemId={selectedItem}
        onClose={() => setDetailVisible(false)}
      />
    </Container>
  );
}
