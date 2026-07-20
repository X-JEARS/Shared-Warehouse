import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ConflictingReservation {
  reservationId: number;
  startTime: number;
  endTime: number;
  userNickname: string;
}

export interface CartItem {
  itemId: number;
  roomId: number;
  itemName: string;
  itemQrcode: string;
  itemImage?: string;
  boxName?: string;
  roomName?: string;
  // 冲突信息
  hasConflict?: boolean;
  conflictingReservations?: ConflictingReservation[];
}

interface CartState {
  items: CartItem[];
  startTime?: number;
  endTime?: number;
  orderTitle?: string;
  addItem: (item: CartItem) => void;
  removeItem: (itemId: number) => void;
  setTime: (start?: number, end?: number) => void;
  setOrderTitle: (title?: string) => void;
  clearCart: () => void;
  removeItemsByRoom: (roomId: number) => void;
  itemCount: () => number;
  itemCountByRoom: (roomId: number) => number;
  // 更新物品冲突信息
  updateConflict: (itemId: number, conflict: { hasConflict: boolean; conflictingReservations?: ConflictingReservation[] }) => void;
  // 清除所有冲突信息
  clearConflicts: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
        items: [],
        startTime: undefined,
        endTime: undefined,
        orderTitle: undefined,
        addItem: (item) =>
          set((state) => {
            const exists = state.items.find((i) => i.itemId === item.itemId);
            if (exists) {
              return {
                items: state.items.map((i) =>
                  i.itemId === item.itemId ? { ...i, ...item } : i
                ),
              };
            }
            return { items: [...state.items, item] };
          }),
        removeItem: (itemId) =>
          set((state) => ({
            items: state.items.filter((i) => i.itemId !== itemId),
          })),
        setTime: (start, end) => set({ startTime: start, endTime: end }),
        setOrderTitle: (title) => set({ orderTitle: title }),
        clearCart: () => set({ items: [], startTime: undefined, endTime: undefined, orderTitle: undefined }),
        removeItemsByRoom: (roomId) =>
          set((state) => ({ items: state.items.filter((i) => i.roomId !== roomId) })),
        itemCount: () => get().items.length,
        itemCountByRoom: (roomId) => get().items.filter((i) => i.roomId === roomId).length,
        updateConflict: (itemId, conflict) =>
          set((state) => ({
            items: state.items.map((i) =>
              i.itemId === itemId
                ? { ...i, hasConflict: conflict.hasConflict, conflictingReservations: conflict.conflictingReservations }
                : i
            ),
          })),
        clearConflicts: () =>
          set((state) => ({
            items: state.items.map((i) => ({
              ...i,
              hasConflict: undefined,
              conflictingReservations: undefined,
            })),
          })),
      }),
    {
      name: 'cart-storage',
      version: 2,
      migrate: (persistedState: any) => {
        const state = persistedState as CartState;
        return {
          ...state,
          items: (state.items || []).filter((i: CartItem) => i.roomId != null),
        };
      },
    }
  )
);
