import { useEffect, useState, useRef, useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, SearchBar } from 'antd-mobile';
import { ItemCardSkeleton } from '../components/skeleton';
import type { InputRef } from 'antd-mobile/es/components/input';
import { AddOutline, SearchOutline, ShopbagOutline, SetOutline } from 'antd-mobile-icons';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { useRoomStore } from '../stores/roomStore';
import { useCartStore } from '../stores/cartStore';

import { swrFetcher } from '../utils/swr';
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
  background: var(--app-color-surface);
  padding: 1px 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--app-color-border);
`;

const SearchContainer = styled.div`
  padding: 8px 12px;
  background: var(--app-color-surface);
`;

const WarehouseMain = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  overscroll-behavior-x: none;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  touch-action: pan-y;
  overscroll-behavior-x: none;
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
  color: var(--app-color-text-weak);
  padding: 4px 0;
  border-bottom: 1px solid var(--app-color-border);
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
  border-radius: var(--app-radius-avatar);
  background: var(--app-color-badge-instock-text);
  color: var(--app-color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: var(--app-shadow-fab);
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
  color: var(--app-color-text);
  margin-bottom: 8px;
`;

const NoRoomText = styled.p`
  font-size: 14px;
  color: var(--app-color-text-secondary);
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
  color: var(--app-color-text);

  &:active {
    opacity: 0.7;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
`;

interface WarehouseBox {
  box_id: number;
  box_name: string;
}

interface PointerStart {
  x: number;
  y: number;
  target: EventTarget | null;
  pointerId: number;
  captured: boolean;
}

const isSwipeIgnoredTarget = (target: EventTarget | null) => (
  target instanceof Element
  && Boolean(target.closest('button, a, input, textarea, [role="tablist"], [role="dialog"]'))
);

export default function Warehouse() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentRoom, rooms } = useRoomStore();
  const cartItemCount = useCartStore((s) => s.itemCountByRoom(currentRoom?.room_id ?? 0));
  const [allInStockItems, setAllInStockItems] = useState<any[]>([]);
  const [allOutOfStockItems, setAllOutOfStockItems] = useState<any[]>([]);
  const [boxes, setBoxes] = useState<WarehouseBox[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState<{ boxId?: number | 'out-of-stock'; tagId?: number }>({});
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [cartVisible, setCartVisible] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const searchInputRef = useRef<InputRef>(null);
  const warehouseMainRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<PointerStart | null>(null);
  const suppressClickRef = useRef(false);
  const boxesRef = useRef<WarehouseBox[]>([]);
  const filtersRef = useRef(filters);

  const itemKey = currentRoom
    ? ['/items', { params: { roomId: currentRoom.room_id } }]
    : null;

  const { data: itemsData, isLoading: itemsLoading, mutate: refreshItems } = useSWR(
    itemKey,
    swrFetcher,
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  const joinRequestKey = currentRoom?.is_admin
    ? `/rooms/${currentRoom.room_id}/join-requests`
    : null;

  const { data: joinRequestsData } = useSWR(
    joinRequestKey,
    swrFetcher,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (itemsData) {
      setAllInStockItems(itemsData.inStock || []);
      setAllOutOfStockItems(itemsData.outOfStock || []);
    }
  }, [itemsData]);

  useEffect(() => {
    setPendingRequestCount(joinRequestsData?.length || 0);
  }, [joinRequestsData]);

  const handleFilterChange = (newFilters: { boxId?: number | 'out-of-stock'; tagId?: number }) => {
    filtersRef.current = newFilters;
    setFilters(newFilters);
  };

  const handleBoxesChange = (nextBoxes: WarehouseBox[]) => {
    boxesRef.current = nextBoxes;
    setBoxes(nextBoxes);
  };

  const switchFilterByDirection = (direction: 1 | -1) => {
    const availableBoxes = boxesRef.current;
    const availableFilters: Array<number | 'out-of-stock' | undefined> = [
      undefined,
      'out-of-stock',
      ...availableBoxes.map((box) => box.box_id),
    ];
    if (availableFilters.length < 2) return false;

    const currentFilters = filtersRef.current;
    const currentIndex = availableFilters.findIndex((boxId) => boxId === currentFilters.boxId);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (baseIndex + direction + availableFilters.length) % availableFilters.length;
    const nextFilters = {
      boxId: availableFilters[nextIndex],
      tagId: currentFilters.tagId,
    };

    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    return true;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || isSwipeIgnoredTarget(event.target)) {
      pointerStartRef.current = null;
      return;
    }

    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      target: event.target,
      pointerId: event.pointerId,
      captured: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) >= 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (!start.captured) {
        event.currentTarget.setPointerCapture?.(start.pointerId);
        start.captured = true;
      }
      event.preventDefault();
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const isHorizontalSwipe = Math.abs(deltaX) >= 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    if (!isHorizontalSwipe || isSwipeIgnoredTarget(start.target)) return;

    event.preventDefault();
    suppressClickRef.current = true;
    switchFilterByDirection(deltaX < 0 ? 1 : -1);
  };

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    boxesRef.current = boxes;
  }, [boxes]);

  useEffect(() => {
    const warehouseMain = warehouseMainRef.current;
    if (!warehouseMain) return;

    let accumulatedDeltaX = 0;
    let lastWheelAt = 0;
    let lastSwitchAt = 0;

    const handleWheel = (event: WheelEvent) => {
      if (isSwipeIgnoredTarget(event.target)) return;

      const horizontalDelta = Math.abs(event.deltaX);
      const verticalDelta = Math.abs(event.deltaY);
      if (horizontalDelta < 1 || horizontalDelta <= verticalDelta) {
        accumulatedDeltaX = 0;
        return;
      }

      // Keep horizontal trackpad gestures inside the warehouse instead of letting
      // the browser interpret them as history navigation.
      event.preventDefault();
      event.stopPropagation();

      const now = performance.now();
      if (now - lastWheelAt > 450) accumulatedDeltaX = 0;
      lastWheelAt = now;

      if (now - lastSwitchAt < 650) {
        accumulatedDeltaX = 0;
        return;
      }

      accumulatedDeltaX += event.deltaX;
      if (Math.abs(accumulatedDeltaX) < 70) return;

      accumulatedDeltaX = 0;
      lastSwitchAt = now;
      // Trackpad wheel deltas follow the opposite direction from the user's
      // finger movement, so invert the mapping for the expected navigation feel.
      switchFilterByDirection(event.deltaX < 0 ? -1 : 1);
    };

    warehouseMain.addEventListener('wheel', handleWheel, { passive: false });
    return () => warehouseMain.removeEventListener('wheel', handleWheel);
  }, []);

  const handleItemClick = (itemId: number) => {
    setSelectedItem(itemId);
    setDetailVisible(true);
  };

  const locale = i18n.language === 'en-US' ? 'en' : 'zh';

  const { inStockItems, outOfStockItems } = useMemo(() => {
    const normalizedSearch = searchQuery.toLocaleLowerCase(locale);
    const matchesCommonFilters = (item: any) => {
      const matchesTag = filters.tagId === undefined
        || (Array.isArray(item.tag_ids) && item.tag_ids.some((tagId: unknown) => Number(tagId) === filters.tagId));
      if (!matchesTag) return false;

      if (!normalizedSearch) return true;
      const name = String(item.item_name || '').toLocaleLowerCase(locale);
      const notice = String(item.item_notice || '').toLocaleLowerCase(locale);
      return name.includes(normalizedSearch) || notice.includes(normalizedSearch);
    };

    if (filters.boxId === 'out-of-stock') {
      return {
        inStockItems: [],
        outOfStockItems: allOutOfStockItems.filter(matchesCommonFilters),
      };
    }

    const filteredInStock = allInStockItems.filter((item) =>
      matchesCommonFilters(item)
      && (filters.boxId === undefined || Number(item.item_current_box_id) === filters.boxId)
    );

    return {
      inStockItems: filteredInStock,
      outOfStockItems: filters.boxId === undefined
        ? allOutOfStockItems.filter(matchesCommonFilters)
        : [],
    };
  }, [allInStockItems, allOutOfStockItems, filters, locale, searchQuery]);

  const groupedInStockItems = useMemo(() => {
    const grouped: Record<string, { name: string; items: any[] }> = {};
    for (const item of inStockItems) {
      const boxKey = item.item_current_box_id || 'no-box';
      const boxName = item.current_box_name || t('warehouse.unassignedBox');
      if (!grouped[boxKey]) {
        grouped[boxKey] = { name: boxName, items: [] };
      }
      grouped[boxKey].items.push(item);
    }
    for (const group of Object.values(grouped)) {
      group.items.sort((a: any, b: any) => (a.item_name || '').localeCompare(b.item_name || '', locale));
    }
    return grouped;
  }, [inStockItems, locale, t]);

  const sortedOutOfStockItems = useMemo(() => {
    return [...outOfStockItems].sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '', locale));
  }, [outOfStockItems, locale]);

  // 没有仓库时的提示
  if (rooms.length === 0) {
    return (
      <Container>
        <Header>
          <WarehouseSelector />
        </Header>
        <Content>
          <NoRoomContainer>
            <NoRoomTitle>{t('warehouse.welcome')}</NoRoomTitle>
            <NoRoomText>{t('warehouse.welcomeDesc')}</NoRoomText>
            <ActionButtons>
              <Button color="primary" onClick={() => navigate('/create-room')}>
                {t('warehouse.createRoom')}
              </Button>
              <Button onClick={() => navigate('/join-room')}>
                {t('warehouse.joinRoom')}
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
          {currentRoom && currentRoom.is_admin && (
            <IconButton onClick={() => navigate(`/room-settings/${currentRoom.room_id}`)}>
              {pendingRequestCount > 0 ? (
                <div style={{ position: 'relative' }}>
                  <SetOutline />
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -6,
                      background: 'var(--app-color-badge-outstock-text)',
                      color: 'var(--app-color-surface)',
                      fontSize: 10,
                      borderRadius: 'var(--app-radius-avatar)',
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
            placeholder={t('warehouse.searchPlaceholder')}
            onSearch={(value) => {
              setSearchQuery(value.trim());
              setShowSearch(false);
            }}
            onBlur={() => {
              if (!searchText) {
                setSearchQuery('');
                setShowSearch(false);
              }
            }}
            showCancelButton
            onCancel={() => {
              setSearchText('');
              setSearchQuery('');
              setShowSearch(false);
            }}
          />
        </SearchContainer>
      )}

      <WarehouseMain
        ref={warehouseMainRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={() => {
          pointerStartRef.current = null;
        }}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return;
          suppressClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {currentRoom && (
          <FilterBar
        roomId={currentRoom?.room_id ?? 0}
            selectedBox={filters.boxId}
            selectedTag={filters.tagId}
            onFilterChange={handleFilterChange}
            onBoxesChange={handleBoxesChange}
          />
        )}

        <Content>
        {itemsLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, padding: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => <ItemCardSkeleton key={i} />)}
          </div>
        ) : inStockItems.length === 0 && outOfStockItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: 'var(--app-color-text-secondary)', marginBottom: 16 }}>
              {filters.boxId === 'out-of-stock' ? t('warehouse.noOutOfStockItems') : t('warehouse.noItems')}
            </p>
            {filters.boxId !== 'out-of-stock' && (
              <Button color="primary" onClick={() => navigate('/create-item')}>
                {t('warehouse.addItem')}
              </Button>
            )}
          </div>
        ) : (
          <ItemList>
            {/* 在库物品：按当前所在盒子分组显示 */}
            {filters.boxId !== 'out-of-stock' && (Object.entries(groupedInStockItems) as [string, { name: string; items: any[] }][]).map(([boxKey, group]) => (
                <BoxGroup key={boxKey}>
                  <BoxTitle>{group.name}</BoxTitle>
                  <ItemGrid>
                    {group.items.map((item: any) => (
                      <ItemCard
                        key={item.item_id}
                        item={item}
                        roomId={currentRoom?.room_id ?? 0}
                        onClick={() => handleItemClick(item.item_id)}
                        showCartButton
                      />
                    ))}
                  </ItemGrid>
                </BoxGroup>
              ))}

            {/* 不在库物品 */}
            {(filters.boxId === 'out-of-stock' ? outOfStockItems.length > 0 : outOfStockItems.length > 0) && (
              <BoxGroup>
                <BoxTitle>{t('warehouse.notInStock')}</BoxTitle>
                <ItemGrid>
                  {sortedOutOfStockItems.map((item) => (
                    <ItemCard
                      key={item.item_id}
                      item={item}
                      roomId={currentRoom?.room_id ?? 0}
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
      </WarehouseMain>

      <FAB>
        {cartItemCount > 0 && (
          <FABButton onClick={() => setCartVisible(true)}>
            <ShopbagOutline />
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: 'var(--app-color-badge-outstock-text)',
                color: 'var(--app-color-white)',
                fontSize: 12,
                borderRadius: 'var(--app-radius-avatar)',
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {cartItemCount}
            </span>
          </FABButton>
        )}
      </FAB>

      <ItemDetail
        visible={detailVisible}
        itemId={selectedItem}
        roomId={currentRoom?.room_id}
        onClose={() => setDetailVisible(false)}
        onUpdate={() => void refreshItems()}
      />

      {currentRoom && (
      <CartPopup
        visible={cartVisible}
        onClose={() => setCartVisible(false)}
        roomId={currentRoom.room_id}
      />
      )}
    </Container>
  );
}
