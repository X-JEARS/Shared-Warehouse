import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, SearchBar, SpinLoading } from 'antd-mobile';
import type { InputRef } from 'antd-mobile/es/components/input';
import { AddOutline, SearchOutline, ShopbagOutline, SetOutline } from 'antd-mobile-icons';
import styled from 'styled-components';
import { useRoomStore } from '../stores/roomStore';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { itemApi, roomApi } from '../services/api';
import WarehouseSelector from '../components/WarehouseSelector';
import FilterBar from '../components/FilterBar';
import ItemCard from '../components/ItemCard';
import ItemDetail from '../components/ItemDetail';
import CartPopup from '../components/CartPopup';

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  background: white;
  padding: 1px 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f0f0f0;
`;

const SearchContainer = styled.div`
  padding: 8px 12px;
  background: white;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  padding-bottom: calc(12px + 50px + 48px + 16px + env(safe-area-inset-bottom, 0px));

  @media (min-width: 768px) {
    padding-bottom: calc(12px + 48px + 16px);
  }
`;

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const BoxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const BoxTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: #666;
  padding: 4px 0;
  border-bottom: 1px solid #f0f0f0;
`;

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
`;

const FAB = styled.div`
  position: fixed;
  right: 16px;
  bottom: calc(50px + env(safe-area-inset-bottom, 0px) + 16px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 100;

  @media (min-width: 768px) {
    bottom: 16px;
  }
`;

const FABButton = styled.div`
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #52c41a;
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

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 2px;
`;

const IconButton = styled.div`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  color: #333;

  &:active {
    opacity: 0.7;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
`;

export default function Warehouse() {
  const navigate = useNavigate();
  const { currentRoom, rooms, setRooms, setCurrentRoom } = useRoomStore();
  const { items: cartItems } = useCartStore();
  const { user } = useAuthStore();
  const [inStockItems, setInStockItems] = useState<any[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState<{ boxId?: number; tagId?: number }>({});
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [cartVisible, setCartVisible] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const searchInputRef = useRef<InputRef>(null);

  // 加载仓库列表
  useEffect(() => {
    const loadRooms = async () => {
      try {
        setRoomsLoading(true);
        const res: any = await roomApi.getAll();
        setRooms(res.data || []);

        // 如果有仓库
        if (res.data?.length > 0) {
          // 检查 currentRoom 是否仍在仓库列表中（验证用户是否仍是该仓库成员）
          if (currentRoom) {
            const isRoomValid = res.data.some((r: any) => r.room_id === currentRoom.room_id);
            if (!isRoomValid) {
              // 如果之前的仓库已不可访问，则选择第一个
              setCurrentRoom(res.data[0]);
            }
            // 如果有效，保持 currentRoom 不变
          } else {
            // 没有 currentRoom 时，选择第一个
            setCurrentRoom(res.data[0]);
          }
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
      loadJoinRequestCount();
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
      setInStockItems(res.data?.inStock || []);
      setOutOfStockItems(res.data?.outOfStock || []);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadJoinRequestCount = async () => {
    if (!currentRoom || currentRoom.room_admin !== user?.user_id) {
      setPendingRequestCount(0);
      return;
    }
    try {
      const res: any = await roomApi.getJoinRequests(currentRoom.room_id);
      setPendingRequestCount(res.data?.length || 0);
    } catch (error) {
      console.error('Failed to load join requests:', error);
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
            <NoRoomTitle>欢迎使用共享仓库</NoRoomTitle>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <WarehouseSelector />
          {currentRoom && currentRoom.room_admin === user?.user_id && (
            <IconButton onClick={() => navigate(`/room-settings/${currentRoom.room_id}`)}>
              {pendingRequestCount > 0 ? (
                <div style={{ position: 'relative' }}>
                  <SetOutline />
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -6,
                      background: '#ff4d4f',
                      color: 'white',
                      fontSize: 10,
                      borderRadius: '50%',
                      minWidth: 14,
                      height: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 2px',
                    }}
                  >
                    {pendingRequestCount}
                  </span>
                </div>
              ) : (
                <SetOutline />
              )}
            </IconButton>
          )}
        </div>
        <HeaderActions>
          {currentRoom && (
            <>
              <IconButton onClick={() => {
                setShowSearch(true);
                setTimeout(() => {
                  searchInputRef.current?.focus();
                }, 100);
              }}>
                <SearchOutline />
              </IconButton>
              <IconButton onClick={() => navigate('/create-item')}>
                <AddOutline />
              </IconButton>
            </>
          )}
        </HeaderActions>
      </Header>

      {currentRoom && showSearch && (
        <SearchContainer>
          <SearchBar
            ref={searchInputRef}
            value={searchText}
            onChange={setSearchText}
            placeholder="搜索物品..."
            onSearch={() => {
              handleSearch();
              setShowSearch(false);
            }}
            onBlur={() => {
              if (!searchText) {
                setShowSearch(false);
              }
            }}
            showCancelButton
            onCancel={() => {
              setSearchText('');
              setShowSearch(false);
            }}
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
        ) : inStockItems.length === 0 && outOfStockItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: '#999', marginBottom: 16 }}>当前仓库暂无物品</p>
            <Button color="primary" onClick={() => navigate('/create-item')}>
              添加物品
            </Button>
          </div>
        ) : (
          <ItemList>
            {/* 在库物品：按当前所在盒子分组显示 */}
            {(() => {
              const groupedItems = inStockItems.reduce((acc, item) => {
                const boxKey = item.item_current_box_id || 'no-box';
                const boxName = item.current_box_name || '未分配盒子';
                if (!acc[boxKey]) {
                  acc[boxKey] = { name: boxName, items: [] };
                }
                acc[boxKey].items.push(item);
                return acc;
              }, {} as Record<string, { name: string; items: any[] }>);
              Object.values(groupedItems).forEach(group => {
                group.items.sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '', 'zh'));
              });

              return (Object.entries(groupedItems) as [string, { name: string; items: any[] }][]).map(([boxKey, group]) => (
                <BoxGroup key={boxKey}>
                  <BoxTitle>{group.name}</BoxTitle>
                  <ItemGrid>
                    {group.items.map((item: any) => (
                      <ItemCard
                        key={item.item_id}
                        item={item}
                        onClick={() => handleItemClick(item.item_id)}
                        showCartButton
                      />
                    ))}
                  </ItemGrid>
                </BoxGroup>
              ));
            })()}

            {/* 不在库物品：统一显示在"不在库中" */}
            {outOfStockItems.length > 0 && (
              <BoxGroup>
                <BoxTitle>不在库中</BoxTitle>
                <ItemGrid>
                  {[...outOfStockItems].sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '', 'zh')).map((item) => (
                    <ItemCard
                      key={item.item_id}
                      item={item}
                      onClick={() => handleItemClick(item.item_id)}
                      showCartButton
                    />
                  ))}
                </ItemGrid>
              </BoxGroup>
            )}
          </ItemList>
        )}
      </Content>

      <FAB>
        {cartItems.length > 0 && (
          <FABButton onClick={() => setCartVisible(true)}>
            <ShopbagOutline />
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
          </FABButton>
        )}
      </FAB>

      <ItemDetail
        visible={detailVisible}
        itemId={selectedItem}
        roomId={currentRoom?.room_id}
        onClose={() => setDetailVisible(false)}
      />

      <CartPopup
        visible={cartVisible}
        onClose={() => setCartVisible(false)}
      />
    </Container>
  );
}
