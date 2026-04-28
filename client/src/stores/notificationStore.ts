import { create } from 'zustand';
import { notificationApi } from '../services/api';

interface NotificationState {
  unreadCount: number;
  fetchUnreadCount: () => Promise<void>;
  setUnreadCount: (count: number) => void;
  decrement: () => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  fetchUnreadCount: async () => {
    try {
      const res: any = await notificationApi.getUnreadCount();
      set({ unreadCount: res.data?.unreadCount || 0 });
    } catch {
      // silently fail
    }
  },
  setUnreadCount: (count) => set({ unreadCount: count }),
  decrement: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
  reset: () => set({ unreadCount: 0 }),
}));