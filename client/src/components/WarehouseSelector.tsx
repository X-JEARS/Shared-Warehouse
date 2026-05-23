import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown, Button } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
import styled from 'styled-components';
import { useRoomStore } from '../stores/roomStore';
import { roomApi } from '../services/api';

const SelectorContainer = styled.div`
  padding: 2px 0;
  background: white;
  display: flex;
  align-items: center;
`;

const RoomName = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 500;
`;

const DropdownContent = styled.div`
  padding: 12px 16px;
  max-height: 300px;
  overflow-y: auto;
`;

const RoomItem = styled.div<{ $active?: boolean }>`
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  color: ${props => props.$active ? '#1677ff' : undefined};
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:last-child {
    border-bottom: none;
  }
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  margin-top: 8px;
`;

export default function WarehouseSelector() {
  const navigate = useNavigate();
  const { rooms, currentRoom, setCurrentRoom, setRooms } = useRoomStore();

  useEffect(() => {
    const loadRooms = async () => {
      try {
        const res: any = await roomApi.getAll();
        const fetchedRooms = res.data || [];
        setRooms(fetchedRooms);
        if (fetchedRooms.length > 0) {
          if (currentRoom) {
            const isRoomValid = fetchedRooms.some((r: any) => r.room_id === currentRoom.room_id);
            if (!isRoomValid) {
              setCurrentRoom(fetchedRooms[0]);
            }
          } else {
            setCurrentRoom(fetchedRooms[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load rooms:', error);
      }
    };
    loadRooms();
  }, []);

  if (rooms.length === 0) {
    return (
      <SelectorContainer>
        <Button size="small" color="primary" onClick={() => navigate('/create-room')}>
          创建仓库
        </Button>
      </SelectorContainer>
    );
  }

  return (
    <SelectorContainer>
      <Dropdown>
        <Dropdown.Item
          key="room"
          title={
            <RoomName>
              {currentRoom?.room_name || '选择仓库'}
            </RoomName>
          }
        >
          <DropdownContent>
            {rooms.map((room) => (
              <RoomItem
                key={room.room_id}
                $active={currentRoom?.room_id === room.room_id}
                onClick={() => setCurrentRoom(room)}
              >
                <span>{room.room_name}</span>
                {room.item_count !== undefined && (
                  <span style={{ fontSize: 12, color: '#999' }}>
                    {room.item_count} 件物品
                  </span>
                )}
              </RoomItem>
            ))}
            <ActionRow>
              <Button
                size="small"
                fill="outline"
                onClick={() => navigate('/create-room')}
              >
                <AddOutline /> 创建
              </Button>
              <Button
                size="small"
                fill="outline"
                onClick={() => navigate('/join-room')}
              >
                加入
              </Button>
            </ActionRow>
          </DropdownContent>
        </Dropdown.Item>
      </Dropdown>
    </SelectorContainer>
  );
}