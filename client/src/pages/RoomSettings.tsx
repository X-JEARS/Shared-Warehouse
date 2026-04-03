import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  NavBar,
  List,
  Button,
  Dialog,
  Input,
  Toast,
  SpinLoading,
  Selector,
  Popup,
} from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
import styled from 'styled-components';
import { roomApi, boxApi, tagApi } from '../services/api';
import { useRoomStore } from '../stores/roomStore';
import { useAuthStore } from '../stores/authStore';
import TrashIcon from '../components/icons/TrashIcon';

const Container = styled.div`
  min-height: 100%;
  background: #f5f5f5;
`;

const Section = styled.div`
  background: white;
  margin-bottom: 12px;
`;

const SectionHeader = styled.div`
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  background: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const MemberItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
`;

const MemberInfo = styled.div`
  flex: 1;
`;

const MemberName = styled.div`
  font-size: 15px;
`;

const MemberMeta = styled.div`
  font-size: 12px;
  color: #999;
`;

const ItemCountBadge = styled.span`
  background: #ff4d4f;
  color: white;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 8px;
`;

interface Box {
  box_id: number;
  box_name: string;
  box_notice?: string;
  item_count?: number;
}

interface Tag {
  tag_id: number;
  tag_name: string;
}

interface Member {
  member_id: number;
  member_user_id: number;
  user_nickname: string;
  user_login_name: string;
  member_name?: string;
}

export default function RoomSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { updateRoom } = useRoomStore();
  const { user } = useAuthStore();
  const [room, setRoom] = useState<any>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteBoxPopup, setDeleteBoxPopup] = useState<{
    visible: boolean;
    box: Box | null;
    targetValue: string;
  }>({ visible: false, box: null, targetValue: '' });

  useEffect(() => {
    loadRoom();
  }, [id, location.key]);

  const loadRoom = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [roomRes, boxesRes, tagsRes, membersRes]: any[] = await Promise.all([
        roomApi.getById(parseInt(id)),
        boxApi.getByRoom(parseInt(id)),
        tagApi.getByRoom(parseInt(id)),
        roomApi.getMembers(parseInt(id)),
      ]);

      setRoom(roomRes.data);
      setBoxes(boxesRes.data || []);
      setTags(tagsRes.data || []);
      setMembers(membersRes.data || []);
    } catch (error) {
      console.error('Failed to load room:', error);
      Toast.show({ icon: 'fail', content: '加载失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditRoom = async () => {
    const result = await Dialog.confirm({
      title: '修改仓库名称',
      content: (
        <Input
          id="roomName"
          placeholder="仓库名称"
          defaultValue={room?.room_name}
          style={{ marginTop: 8 }}
        />
      ),
    });

    if (result) {
      const name = (document.getElementById('roomName') as HTMLInputElement)?.value;
      if (!name) {
        Toast.show({ content: '请输入名称' });
        return;
      }

      try {
        await roomApi.update(parseInt(id!), { name });
        setRoom({ ...room, room_name: name });
        updateRoom(parseInt(id!), { room_name: name });
        Toast.show({ icon: 'success', content: '修改成功' });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '修改失败' });
      }
    }
  };

  const handleAddBox = () => {
    navigate(`/add-box/${id}`);
  };

  const handleDeleteBox = async (box: Box) => {
    const itemCount = box.item_count || 0;
    const isLastBox = boxes.length <= 1;

    // 如果是最后一个盒子，不允许删除
    if (isLastBox) {
      Toast.show({ content: '无法删除最后一个盒子' });
      return;
    }

    // 如果盒子中没有物品，直接删除
    if (itemCount === 0) {
      const result = await Dialog.confirm({
        content: `确定要删除盒子「${box.box_name || `盒子 ${box.box_id}`}」吗？`,
      });

      if (result) {
        try {
          await boxApi.delete(box.box_id);
          setBoxes(boxes.filter((b) => b.box_id !== box.box_id));
          Toast.show({ icon: 'success', content: '删除成功' });
        } catch (error: any) {
          Toast.show({ icon: 'fail', content: error.message || '删除失败' });
        }
      }
      return;
    }

    // 盒子中有物品，打开弹窗选择移动目标
    setDeleteBoxPopup({ visible: true, box, targetValue: '' });
  };

  const confirmDeleteBox = async () => {
    const { box, targetValue } = deleteBoxPopup;
    if (!box || !targetValue) {
      Toast.show({ content: '请选择移动目标' });
      return;
    }

    try {
      if (targetValue === 'user_hand') {
        await boxApi.delete(box.box_id, { toUserHand: true });
      } else {
        const targetBoxId = parseInt(targetValue.replace('box_', ''));
        await boxApi.delete(box.box_id, { targetBoxId });
      }

      setBoxes(boxes.filter((b) => b.box_id !== box.box_id));
      setDeleteBoxPopup({ visible: false, box: null, targetValue: '' });
      Toast.show({ icon: 'success', content: '删除成功' });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '删除失败' });
    }
  };

  const handleAddTag = async () => {
    const result = await Dialog.confirm({
      title: '添加标签',
      content: (
        <Input
          id="tagName"
          placeholder="标签名称"
          style={{ marginTop: 8 }}
        />
      ),
    });

    if (result) {
      const name = (document.getElementById('tagName') as HTMLInputElement)?.value;
      if (!name) {
        Toast.show({ content: '请输入标签名称' });
        return;
      }

      try {
        const res: any = await tagApi.create(parseInt(id!), name);
        setTags([...tags, res.data]);
        Toast.show({ icon: 'success', content: '添加成功' });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '添加失败' });
      }
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    const result = await Dialog.confirm({
      content: '确定要删除这个标签吗？',
    });

    if (result) {
      try {
        await tagApi.delete(tagId);
        setTags(tags.filter((t) => t.tag_id !== tagId));
        Toast.show({ icon: 'success', content: '删除成功' });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '删除失败' });
      }
    }
  };

  const handleRemoveMember = async (memberId: number, memberName: string) => {
    const result = await Dialog.confirm({
      content: `确定要移除成员 ${memberName} 吗？`,
    });

    if (result) {
      try {
        await roomApi.removeMember(parseInt(id!), memberId);
        setMembers(members.filter((m) => m.member_user_id !== memberId));
        Toast.show({ icon: 'success', content: '移除成功' });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '移除失败' });
      }
    }
  };

  if (loading) {
    return (
      <Container style={{ textAlign: 'center', paddingTop: 100 }}>
        <SpinLoading />
      </Container>
    );
  }

  // 权限检查：只有管理员可以访问
  if (!room || room.room_admin !== user?.user_id) {
    return (
      <Container>
        <NavBar onBack={() => navigate(-1)}>仓库设置</NavBar>
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
          您不是该仓库的管理员，无法访问此页面
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <NavBar onBack={() => navigate(-1)}>仓库设置</NavBar>

      <Section>
        <List>
          <List.Item onClick={handleEditRoom}>
            仓库名称: {room?.room_name}
          </List.Item>
          <List.Item>
            仓库ID: {room?.room_id}
          </List.Item>
        </List>
      </Section>

      <SectionHeader>
        盒子管理
        <Button size="small" onClick={handleAddBox}>
          <AddOutline /> 添加
        </Button>
      </SectionHeader>
      <Section>
        {boxes.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
            暂无盒子
          </div>
        ) : (
          boxes.map((box) => (
            <MemberItem key={box.box_id}>
              <MemberInfo>
                <MemberName>
                  {box.box_name || `盒子 ${box.box_id}`}
                  {(box.item_count || 0) > 0 && (
                    <ItemCountBadge>{box.item_count}</ItemCountBadge>
                  )}
                </MemberName>
                {box.box_notice && (
                  <MemberMeta>{box.box_notice}</MemberMeta>
                )}
              </MemberInfo>
              <TrashIcon
                style={{ color: '#ff4d4f', cursor: 'pointer' }}
                onClick={() => handleDeleteBox(box)}
              />
            </MemberItem>
          ))
        )}
      </Section>

      <SectionHeader>
        标签管理
        <Button size="small" onClick={handleAddTag}>
          <AddOutline /> 添加
        </Button>
      </SectionHeader>
      <Section>
        {tags.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
            暂无标签
          </div>
        ) : (
          tags.map((tag) => (
            <MemberItem key={tag.tag_id}>
              <MemberInfo>
                <MemberName>{tag.tag_name}</MemberName>
              </MemberInfo>
              <TrashIcon
                style={{ color: '#ff4d4f', cursor: 'pointer' }}
                onClick={() => handleDeleteTag(tag.tag_id)}
              />
            </MemberItem>
          ))
        )}
      </Section>

      <SectionHeader>
        成员管理
        <span style={{ fontWeight: 400, color: '#999', fontSize: 13 }}>
          ({members.length}人)
        </span>
      </SectionHeader>
      <Section>
        {members.map((member) => (
          <MemberItem key={member.member_id}>
            <MemberInfo>
              <MemberName>
                {member.member_name || member.user_nickname}
                {member.member_user_id === room?.room_admin && ' (管理员)'}
              </MemberName>
              <MemberMeta>@{member.user_login_name}</MemberMeta>
            </MemberInfo>
            {member.member_user_id !== room?.room_admin && (
              <TrashIcon
                style={{ color: '#ff4d4f', cursor: 'pointer' }}
                onClick={() =>
                  handleRemoveMember(
                    member.member_user_id,
                    member.member_name || member.user_nickname
                  )
                }
              />
            )}
          </MemberItem>
        ))}
      </Section>

      {/* 删除盒子弹窗 */}
      <Popup
        visible={deleteBoxPopup.visible}
        onMaskClick={() => setDeleteBoxPopup({ visible: false, box: null, targetValue: '' })}
        bodyStyle={{ borderRadius: '16px 16px 0 0' }}
      >
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            删除盒子
          </div>
          <div style={{ marginBottom: 12, color: '#666' }}>
            盒子「{deleteBoxPopup.box?.box_name || `盒子 ${deleteBoxPopup.box?.box_id}`}」中有{' '}
            {deleteBoxPopup.box?.item_count || 0} 个物品，请选择移动目标：
          </div>
          <Selector
            options={[
              ...boxes
                .filter((b) => b.box_id !== deleteBoxPopup.box?.box_id)
                .map((b) => ({
                  label: b.box_name || `盒子 ${b.box_id}`,
                  value: `box_${b.box_id}`,
                })),
              { label: '用户手中', value: 'user_hand' },
            ]}
            value={deleteBoxPopup.targetValue ? [deleteBoxPopup.targetValue] : []}
            onChange={(arr) =>
              setDeleteBoxPopup({ ...deleteBoxPopup, targetValue: arr[0] || '' })
            }
            style={{ '--gap': '8px', marginBottom: 16 }}
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <Button
              block
              onClick={() => setDeleteBoxPopup({ visible: false, box: null, targetValue: '' })}
            >
              取消
            </Button>
            <Button
              block
              color="danger"
              onClick={confirmDeleteBox}
              disabled={!deleteBoxPopup.targetValue}
            >
              确认删除
            </Button>
          </div>
        </div>
      </Popup>
    </Container>
  );
}
