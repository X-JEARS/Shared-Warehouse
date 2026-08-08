import { useEffect, useState, useRef, useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, SearchBar, Skeleton } from 'antd-mobile';
import { ItemCardSkeleton } from '../components/skeleton';
import type { InputRef } from 'antd-mobile/es/components/input';
import type { CSSProperties } from 'react';
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

const SwipeViewport = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const SwipeTrack = styled.div<{ $offset: number; $animated: boolean }>`
  width: 300%;
  height: 100%;
  display: flex;
  transform: translate3d(calc(-33.333333% + ${(props) => props.$offset}px), 0, 0);
  transition: ${(props) => (props.$animated ? 'transform 0.24s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none')};
  will-change: transform;
`;

const SwipePane = styled.div`
  width: calc(100% / 3);
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
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
  line-height: 17px;
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

const SWIPE_LOCK_DISTANCE = 12;
const SWIPE_TRIGGER_DISTANCE = 56;
const SWIPE_TRIGGER_RATIO = 0.22;
const SWIPE_ANIMATION_MS = 240;
const WHEEL_SETTLE_DELAY = 90;
const WHEEL_DELTA_TO_DRAG_RATIO = 1;
const WHEEL_NEW_GESTURE_GAP = 56;
const WHEEL_NEW_GESTURE_ACCELERATION = 1.8;
const WHEEL_NEW_GESTURE_MIN_DELTA = 12;
const WHEEL_DECELERATION_RATIO = 0.82;

interface WarehouseBox {
  box_id: number;
  box_name: string;
}

type BoxFilterId = number | 'out-of-stock' | undefined;

interface PointerStart {
  x: number;
  y: number;
  target: EventTarget | null;
  pointerId: number;
  captured: boolean;
  dragging: boolean;
}

interface SwipeProgress {
  fromIndex: number;
  toIndex: number;
  progress: number;
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
  const [filters, setFilters] = useState<{ boxId?: BoxFilterId; tagId?: number }>({});
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
  const swipeOffsetRef = useRef(0);
  const swipeCommitRef = useRef<{ direction: 1 | -1 } | null>(null);
  const swipeAnimationActiveRef = useRef(false);
  const wheelSettleTimerRef = useRef<number | null>(null);
  const swipeAnimationTimerRef = useRef<number | null>(null);
  const wheelGestureActiveRef = useRef(false);
  const wheelGestureDirectionRef = useRef<1 | -1 | null>(null);
  const wheelLastEventAtRef = useRef(0);
  const wheelLastDeltaRef = useRef(0);
  const wheelGestureDeceleratingRef = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);

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

  const setSwipeOffsetValue = (offset: number) => {
    swipeOffsetRef.current = offset;
    setSwipeOffset(offset);
  };

  const clearWheelSettleTimer = () => {
    if (wheelSettleTimerRef.current === null) return;
    window.clearTimeout(wheelSettleTimerRef.current);
    wheelSettleTimerRef.current = null;
  };

  const clearSwipeAnimationTimer = () => {
    if (swipeAnimationTimerRef.current === null) return;
    window.clearTimeout(swipeAnimationTimerRef.current);
    swipeAnimationTimerRef.current = null;
  };

  const resetWheelGestureState = () => {
    wheelGestureActiveRef.current = false;
    wheelGestureDirectionRef.current = null;
    wheelLastEventAtRef.current = 0;
    wheelLastDeltaRef.current = 0;
    wheelGestureDeceleratingRef.current = false;
  };

  const getAvailableFilters = (): BoxFilterId[] => [
    undefined,
    'out-of-stock',
    ...boxesRef.current.map((box) => box.box_id),
  ];

  const getCurrentFilterIndex = (availableFilters = getAvailableFilters()) => {
    const currentIndex = availableFilters.findIndex((boxId) => boxId === filtersRef.current.boxId);
    return currentIndex >= 0 ? currentIndex : 0;
  };

  const getNextFilterIndex = (direction: 1 | -1, availableFilters = getAvailableFilters()) => {
    if (availableFilters.length < 2) return getCurrentFilterIndex(availableFilters);
    return (getCurrentFilterIndex(availableFilters) + direction + availableFilters.length) % availableFilters.length;
  };

  const resetSwipeState = () => {
    clearWheelSettleTimer();
    clearSwipeAnimationTimer();
    resetWheelGestureState();
    swipeAnimationActiveRef.current = false;
    swipeCommitRef.current = null;
    setIsSwipeAnimating(false);
    setSwipeOffsetValue(0);
  };

  const handleFilterChange = (newFilters: { boxId?: BoxFilterId; tagId?: number }) => {
    resetSwipeState();
    filtersRef.current = newFilters;
    setFilters(newFilters);
  };

  const handleBoxesChange = (nextBoxes: WarehouseBox[]) => {
    boxesRef.current = nextBoxes;
    setBoxes(nextBoxes);
  };

  const commitFilterByDirection = (direction: 1 | -1) => {
    const availableFilters = getAvailableFilters();
    if (availableFilters.length < 2) return false;

    const nextIndex = getNextFilterIndex(direction, availableFilters);
    const nextFilters = {
      boxId: availableFilters[nextIndex],
      tagId: filtersRef.current.tagId,
    };
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    return true;
  };

  const completeSwipeTransition = () => {
    if (!swipeAnimationActiveRef.current) return;

    swipeAnimationActiveRef.current = false;
    clearSwipeAnimationTimer();
    const commit = swipeCommitRef.current;
    swipeCommitRef.current = null;

    if (commit) {
      commitFilterByDirection(commit.direction);
    }

    setIsSwipeAnimating(false);
    setSwipeOffsetValue(0);
  };

  const settleSwipe = (direction?: 1 | -1) => {
    const width = warehouseMainRef.current?.clientWidth || 1;
    const targetDirection = direction ?? (
      Math.abs(swipeOffsetRef.current) >= Math.max(SWIPE_TRIGGER_DISTANCE, width * SWIPE_TRIGGER_RATIO)
        ? (swipeOffsetRef.current < 0 ? 1 : -1)
        : undefined
    );

    clearSwipeAnimationTimer();

    if (!targetDirection && swipeOffsetRef.current === 0) {
      swipeAnimationActiveRef.current = false;
      setIsSwipeAnimating(false);
      return;
    }

    swipeAnimationActiveRef.current = true;
    setIsSwipeAnimating(true);
    if (targetDirection && getAvailableFilters().length > 1) {
      swipeCommitRef.current = { direction: targetDirection };
      setSwipeOffsetValue(targetDirection === 1 ? -width : width);
    } else {
      swipeCommitRef.current = null;
      setSwipeOffsetValue(0);
    }

    swipeAnimationTimerRef.current = window.setTimeout(() => {
      completeSwipeTransition();
    }, SWIPE_ANIMATION_MS + 20);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || isSwipeIgnoredTarget(event.target)) {
      pointerStartRef.current = null;
      return;
    }

    if (swipeAnimationActiveRef.current) {
      completeSwipeTransition();
    }

    clearWheelSettleTimer();
    clearSwipeAnimationTimer();
    resetWheelGestureState();
    swipeAnimationActiveRef.current = false;
    swipeCommitRef.current = null;
    setIsSwipeAnimating(false);
    setSwipeOffsetValue(0);
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      target: event.target,
      pointerId: event.pointerId,
      captured: false,
      dragging: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (
      !start.dragging
      && Math.abs(deltaX) >= SWIPE_LOCK_DISTANCE
      && Math.abs(deltaX) > Math.abs(deltaY) * 1.2
    ) {
      if (!start.captured) {
        event.currentTarget.setPointerCapture?.(start.pointerId);
        start.captured = true;
      }
      start.dragging = true;
    }

    if (start.dragging) {
      const width = event.currentTarget.clientWidth || 1;
      event.preventDefault();
      setSwipeOffsetValue(Math.max(-width, Math.min(width, deltaX)));
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) {
      return;
    }

    if (!start.dragging || isSwipeIgnoredTarget(start.target)) return;

    event.preventDefault();
    suppressClickRef.current = true;
    settleSwipe();
  };

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    boxesRef.current = boxes;
  }, [boxes]);

  const filterSequence = useMemo<BoxFilterId[]>(() => [
    undefined,
    'out-of-stock',
    ...boxes.map((box) => box.box_id),
  ], [boxes]);

  const currentFilterIndex = useMemo(() => {
    const index = filterSequence.findIndex((boxId) => boxId === filters.boxId);
    return index >= 0 ? index : 0;
  }, [filterSequence, filters.boxId]);

  const previousBoxId = filterSequence[(currentFilterIndex - 1 + filterSequence.length) % filterSequence.length];
  const nextBoxId = filterSequence[(currentFilterIndex + 1) % filterSequence.length];

  const swipeProgress = useMemo<SwipeProgress | undefined>(() => {
    if (filterSequence.length < 2 || swipeOffset === 0) return undefined;

    const width = warehouseMainRef.current?.clientWidth || 1;
    const direction = swipeOffset < 0 ? 1 : -1;
    return {
      fromIndex: currentFilterIndex,
      toIndex: (currentFilterIndex + direction + filterSequence.length) % filterSequence.length,
      progress: Math.min(1, Math.abs(swipeOffset) / width),
    };
  }, [currentFilterIndex, filterSequence.length, swipeOffset]);

  useEffect(() => {
    const warehouseMain = warehouseMainRef.current;
    if (!warehouseMain) return;

    const handleWheel = (event: WheelEvent) => {
      if (isSwipeIgnoredTarget(event.target)) return;

      const horizontalDelta = Math.abs(event.deltaX);
      const verticalDelta = Math.abs(event.deltaY);
      if (horizontalDelta < 1 || horizontalDelta <= verticalDelta) {
        return;
      }

      // Keep horizontal trackpad gestures inside the warehouse instead of letting
      // the browser interpret them as history navigation.
      event.preventDefault();
      event.stopPropagation();

      const now = performance.now();
      const wheelDirection: 1 | -1 = event.deltaX > 0 ? 1 : -1;
      const eventGap = now - wheelLastEventAtRef.current;
      const previousDelta = wheelLastDeltaRef.current;
      const isNewGesture = wheelGestureActiveRef.current && (
        wheelGestureDirectionRef.current !== wheelDirection
        || eventGap > WHEEL_NEW_GESTURE_GAP
        || (
          wheelGestureDeceleratingRef.current
          && horizontalDelta >= Math.max(
            WHEEL_NEW_GESTURE_MIN_DELTA,
            previousDelta * WHEEL_NEW_GESTURE_ACCELERATION
          )
          && horizontalDelta - previousDelta >= WHEEL_NEW_GESTURE_MIN_DELTA / 2
        )
      );

      if (isNewGesture) {
        clearWheelSettleTimer();
        settleSwipe();
        completeSwipeTransition();
        resetWheelGestureState();
      }

      if (swipeAnimationActiveRef.current) {
        completeSwipeTransition();
      }

      clearWheelSettleTimer();
      clearSwipeAnimationTimer();
      swipeAnimationActiveRef.current = false;
      setIsSwipeAnimating(false);

      const width = warehouseMain.clientWidth || 1;
      // Trackpad wheel deltas are the direction the page would scroll, so invert
      // them to match the visual movement of the user's fingers. Trackpad and
      // pointer movement use the same one-to-one pixel scale.
      const nextOffset = Math.max(
        -width,
        Math.min(width, swipeOffsetRef.current - event.deltaX * WHEEL_DELTA_TO_DRAG_RATIO)
      );

      if (!wheelGestureActiveRef.current) {
        wheelGestureActiveRef.current = true;
        wheelGestureDirectionRef.current = wheelDirection;
        wheelGestureDeceleratingRef.current = false;
      } else if (previousDelta > 0 && horizontalDelta < previousDelta * WHEEL_DECELERATION_RATIO) {
        wheelGestureDeceleratingRef.current = true;
      }

      setSwipeOffsetValue(nextOffset);
      wheelLastEventAtRef.current = now;
      wheelLastDeltaRef.current = horizontalDelta;

      wheelSettleTimerRef.current = window.setTimeout(() => {
        wheelSettleTimerRef.current = null;
        resetWheelGestureState();
        settleSwipe();
      }, WHEEL_SETTLE_DELAY);
    };

    warehouseMain.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      clearWheelSettleTimer();
      clearSwipeAnimationTimer();
      warehouseMain.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleItemClick = (itemId: number) => {
    setSelectedItem(itemId);
    setDetailVisible(true);
  };

  const locale = i18n.language === 'en-US' ? 'en' : 'zh';

  const getItemsForBox = (boxId: BoxFilterId) => {
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

    if (boxId === 'out-of-stock') {
      return {
        inStockItems: [],
        outOfStockItems: allOutOfStockItems.filter(matchesCommonFilters),
      };
    }

    const filteredInStock = allInStockItems.filter((item) =>
      matchesCommonFilters(item)
      && (boxId === undefined || Number(item.item_current_box_id) === boxId)
    );

    return {
      inStockItems: filteredInStock,
      outOfStockItems: boxId === undefined
        ? allOutOfStockItems.filter(matchesCommonFilters)
        : [],
    };
  };

  const getPageData = (boxId: BoxFilterId) => {
    const { inStockItems, outOfStockItems } = getItemsForBox(boxId);
    const groupedInStockItems: Record<string, { name: string; items: any[] }> = {};
    for (const item of inStockItems) {
      const boxKey = item.item_current_box_id || 'no-box';
      const boxName = item.current_box_name || t('warehouse.unassignedBox');
      if (!groupedInStockItems[boxKey]) {
        groupedInStockItems[boxKey] = { name: boxName, items: [] };
      }
      groupedInStockItems[boxKey].items.push(item);
    }
    for (const group of Object.values(groupedInStockItems)) {
      group.items.sort((a: any, b: any) => (a.item_name || '').localeCompare(b.item_name || '', locale));
    }
    return {
      inStockItems,
      outOfStockItems,
      groupedInStockItems,
      sortedOutOfStockItems: [...outOfStockItems].sort((a, b) => (a.item_name || '').localeCompare(b.item_name || '', locale)),
    };
  };

  const currentPageData = getPageData(filters.boxId);

  const renderSwipePage = (boxId: BoxFilterId, slot: 'previous' | 'current' | 'next') => {
    const {
      inStockItems,
      outOfStockItems,
      groupedInStockItems,
      sortedOutOfStockItems,
    } = slot === 'current' ? currentPageData : getPageData(boxId);

    return (
      <Content aria-hidden={slot !== 'current'}>
        {itemsLoading ? (
          <ItemList aria-hidden="true">
            <BoxGroup>
              <BoxTitle>
                <Skeleton animated style={{ '--width': '96px', '--height': '17px', '--border-radius': 'var(--app-radius-s)' } as CSSProperties} />
              </BoxTitle>
              <ItemGrid>
                {Array.from({ length: 8 }).map((_, i) => <ItemCardSkeleton key={i} />)}
              </ItemGrid>
            </BoxGroup>
          </ItemList>
        ) : inStockItems.length === 0 && outOfStockItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: 'var(--app-color-text-secondary)', marginBottom: 16 }}>
              {boxId === 'out-of-stock' ? t('warehouse.noOutOfStockItems') : t('warehouse.noItems')}
            </p>
            {boxId !== 'out-of-stock' && (
              <Button color="primary" onClick={() => navigate('/create-item')}>
                {t('warehouse.addItem')}
              </Button>
            )}
          </div>
        ) : (
          <ItemList>
            {/* 在库物品：按当前所在盒子分组显示 */}
            {boxId !== 'out-of-stock' && (Object.entries(groupedInStockItems) as [string, { name: string; items: any[] }][]).map(([boxKey, group]) => (
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
            {outOfStockItems.length > 0 && (
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
    );
  };

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
          settleSwipe();
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
            swipeProgress={swipeProgress}
            swipeAnimating={isSwipeAnimating}
          />
        )}

        <SwipeViewport>
          <SwipeTrack
            $offset={swipeOffset}
            $animated={isSwipeAnimating}
          >
            <SwipePane>{renderSwipePage(previousBoxId, 'previous')}</SwipePane>
            <SwipePane>{renderSwipePage(filters.boxId, 'current')}</SwipePane>
            <SwipePane>{renderSwipePage(nextBoxId, 'next')}</SwipePane>
          </SwipeTrack>
        </SwipeViewport>
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
