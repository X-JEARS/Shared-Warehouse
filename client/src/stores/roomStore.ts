import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Room {
  room_id: number;
  room_name: string;
  room_admin: number;
  room_create_time: number;
  room_notice?: string;
  member_name?: string;
  item_count?: number;
  is_admin?: boolean;
}

interface RoomState {
  currentRoom: Room | null;
  rooms: Room[];
  setCurrentRoom: (room: Room | null) => void;
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  updateRoom: (id: number, data: Partial<Room>) => void;
  removeRoom: (id: number) => void;
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set) => ({
      currentRoom: null,
      rooms: [],
      setCurrentRoom: (room) => set({ currentRoom: room }),
      setRooms: (rooms) => set({ rooms }),
      addRoom: (room) =>
        set((state) => ({ rooms: [...state.rooms, room] })),
      updateRoom: (id, data) =>
        set((state) => ({
          rooms: state.rooms.map((r) =>
            r.room_id === id ? { ...r, ...data } : r
          ),
          currentRoom:
            state.currentRoom?.room_id === id
              ? { ...state.currentRoom, ...data }
              : state.currentRoom,
        })),
      removeRoom: (id) =>
        set((state) => ({
          rooms: state.rooms.filter((r) => r.room_id !== id),
          currentRoom:
            state.currentRoom?.room_id === id ? null : state.currentRoom,
        })),
    }),
    {
      name: 'room-storage',
      version: 1,
      migrate: (persistedState) => persistedState as RoomState,
    }
  )
);
