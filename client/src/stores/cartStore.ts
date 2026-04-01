import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  itemId: number;
  itemName: string;
  itemQrcode: string;
  itemImage?: string;
  boxName?: string;
  roomName?: string;
}

interface CartState {
  items: CartItem[];
  startTime?: number;
  endTime?: number;
  addItem: (item: CartItem) => void;
  removeItem: (itemId: number) => void;
  setTime: (start?: number, end?: number) => void;
  clearCart: () => void;
  itemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
        items: [],
        startTime: undefined,
        endTime: undefined,
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
        clearCart: () => set({ items: [], startTime: undefined, endTime: undefined }),
        itemCount: () => get().items.length,
      }),
    {
      name: 'cart-storage',
    }
  )
);
