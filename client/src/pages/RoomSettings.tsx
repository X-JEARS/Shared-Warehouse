import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  NavBar,
  Button,
  Dialog,
  Input,
  Toast,
  SpinLoading,
  Selector,
  Popup,
} from 'antd-mobile';
import { AddOutline, CheckCircleOutline, CloseCircleOutline, CloseOutline } from 'antd-mobile-icons';
import styled from 'styled-components';
import { roomApi, boxApi, tagApi } from '../services/api';
import { useRoomStore } from '../stores/roomStore';
import { useAuthStore } from '../stores/authStore';
import TrashIcon from '../components/icons/TrashIcon';

const Container = styled.div`
  min-height: 100%;
  background: #f5f5f5;
  padding: 12px 16px;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const CardHeader = styled.div`
  padding: 14px 16px 8px;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const RoomNameRow = styled.div`
  display: flex;
  align-items: center;
  padding: 16px;
`;

const RoomName = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #333;
`;

const EditIconButton = styled.button`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #1677ff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;

  &:hover {
    opacity: 0.8;
  }
`;

function EditIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

const RoomId = styled.div`
  padding: 0 16px 16px;
  font-size: 13px;
  color: #999;
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

const BoxGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 12px 16px;
`;

const BoxCard = styled.div`
  background: #f8f8f8;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;

  &:active {
    background: #eee;
  }
`;

const BoxCardInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const BoxCardName = styled.div`
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const BoxCardMeta = styled.div`
  font-size: 12px;
  color: #999;
  margin-top: 4px;
`;

const BoxDeleteIcon = styled.div`
  flex-shrink: 0;
  margin-left: 8px;
`;

const ItemCountBadge = styled.span`
  background: #ff4d4f;
  color: white;
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 10px;
  margin-left: 4px;
`;

const TagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
`;

const TagBadge = styled.span<{ $selected?: boolean }>`
  font-size: 13px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  background: ${(props) => (props.$selected ? '#ff4d4f' : '#e6f4ff')};
  color: ${(props) => (props.$selected ? '#fff' : '#1677ff')};
`;

const DeleteBar = styled.div`
  display: flex;
  gap: 12px;
  padding: 8px 16px;
  border-top: 1px solid #f0f0f0;
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

interface JoinRequest {
  request_id: number;
  request_user_id: number;
  request_member_name?: string;
  request_create_time: number;
  user_nickname: string;
  user_login_name: string;
  user_avatar?: string;
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
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteBoxPopup, setDeleteBoxPopup] = useState<{
    visible: boolean;
    box: Box | null;
    targetValue: string;
  }>({ visible: false, box: null, targetValue: '' });
  const [tagDeleteMode, setTagDeleteMode] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());

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

      // 单独加载加入请求，失败不影响页面其他功能
      try {
        const requestsRes: any = await roomApi.getJoinRequests(parseInt(id));
        setJoinRequests(requestsRes.data || []);
      } catch (e) {
        console.error('Failed to load join requests:', e);
        setJoinRequests([]);
      }
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

  const handleRenameBox = async (box: Box) => {
    const result = await Dialog.confirm({
      title: '修改盒子名称',
      content: (
        <Input
          id="boxRenameInput"
          placeholder="盒子名称"
          defaultValue={box.box_name || ''}
          style={{ marginTop: 8 }}
        />
      ),
    });

    if (result) {
      const name = (document.getElementById('boxRenameInput') as HTMLInputElement)?.value;
      if (!name) {
        Toast.show({ content: '请输入名称' });
        return;
      }

      try {
        await boxApi.update(box.box_id, { name });
        setBoxes(boxes.map((b) => b.box_id === box.box_id ? { ...b, box_name: name } : b));
        Toast.show({ icon: 'success', content: '修改成功' });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '修改失败' });
      }
    }
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

  const handleRenameTag = async (tag: Tag) => {
    if (tagDeleteMode) {
      toggleTagSelection(tag.tag_id);
      return;
    }

    const result = await Dialog.confirm({
      title: '修改标签名称',
      content: (
        <Input
          id="tagRenameInput"
          placeholder="标签名称"
          defaultValue={tag.tag_name}
          style={{ marginTop: 8 }}
        />
      ),
    });

    if (result) {
      const name = (document.getElementById('tagRenameInput') as HTMLInputElement)?.value;
      if (!name) {
        Toast.show({ content: '请输入标签名称' });
        return;
      }

      try {
        await tagApi.update(tag.tag_id, name);
        setTags(tags.map((t) => t.tag_id === tag.tag_id ? { ...t, tag_name: name } : t));
        Toast.show({ icon: 'success', content: '修改成功' });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '修改失败' });
      }
    }
  };

  const handleConfirmDeleteTags = async () => {
    if (selectedTagIds.size === 0) {
      Toast.show({ content: '请选择要删除的标签' });
      return;
    }
    try {
      await Promise.all(Array.from(selectedTagIds).map((id) => tagApi.delete(id)));
      setTags(tags.filter((t) => !selectedTagIds.has(t.tag_id)));
      setSelectedTagIds(new Set());
      setTagDeleteMode(false);
      Toast.show({ icon: 'success', content: '删除成功' });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '删除失败' });
    }
  };

  const toggleTagSelection = (tagId: number) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
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

  const handleApproveRequest = async (request: JoinRequest) => {
    try {
      await roomApi.approveJoinRequest(parseInt(id!), request.request_id);
      // 移除请求并刷新成员列表
      setJoinRequests(joinRequests.filter((r) => r.request_id !== request.request_id));
      // 重新加载成员列表
      const membersRes: any = await roomApi.getMembers(parseInt(id!));
      setMembers(membersRes.data || []);
      Toast.show({ icon: 'success', content: '已通过申请' });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '操作失败' });
    }
  };

  const handleRejectRequest = async (request: JoinRequest) => {
    const result = await Dialog.confirm({
      content: `确定要拒绝 ${request.user_nickname} 的加入申请吗？`,
    });

    if (result) {
      try {
        await roomApi.rejectJoinRequest(parseInt(id!), request.request_id);
        setJoinRequests(joinRequests.filter((r) => r.request_id !== request.request_id));
        Toast.show({ icon: 'success', content: '已拒绝申请' });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '操作失败' });
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
      <div style={{ marginTop: 8 }} />

      <Card>
        <RoomNameRow>
          <RoomName>{room?.room_name}</RoomName>
          <EditIconButton onClick={handleEditRoom}>
            <EditIcon size={16} />
          </EditIconButton>
        </RoomNameRow>
        <RoomId>ID: {room?.room_id}</RoomId>
      </Card>

      {joinRequests.length > 0 && (
        <Card>
          <CardHeader>
            加入申请
            <span style={{ fontWeight: 400, color: '#ff4d4f', fontSize: 13 }}>
              ({joinRequests.length}个待处理)
            </span>
          </CardHeader>
          {joinRequests.map((request) => (
              <MemberItem key={request.request_id}>
                <MemberInfo>
                  <MemberName>
                    {request.request_member_name || request.user_nickname}
                  </MemberName>
                  <MemberMeta>
                    @{request.user_login_name} ·{' '}
                    {new Date(request.request_create_time).toLocaleDateString()}
                  </MemberMeta>
                </MemberInfo>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => handleApproveRequest(request)}
                  >
                    <CheckCircleOutline /> 通过
                  </Button>
                  <Button
                    size="small"
                    color="danger"
                    onClick={() => handleRejectRequest(request)}
                  >
                    <CloseCircleOutline /> 拒绝
                  </Button>
                </div>
              </MemberItem>
            ))}
        </Card>
      )}

      <Card>
        <CardHeader>
          盒子管理
          <Button size="small" onClick={handleAddBox}>
            <AddOutline /> 添加
          </Button>
        </CardHeader>
        {boxes.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
            暂无盒子
          </div>
        ) : (
          <BoxGrid>
            {boxes.map((box) => (
              <BoxCard key={box.box_id} onClick={() => handleRenameBox(box)}>
                <BoxCardInfo>
                  <BoxCardName>
                    {box.box_name || `盒子 ${box.box_id}`}
                    {(box.item_count || 0) > 0 && (
                      <ItemCountBadge>{box.item_count}</ItemCountBadge>
                    )}
                  </BoxCardName>
                  {box.box_notice && (
                    <BoxCardMeta>{box.box_notice}</BoxCardMeta>
                  )}
                </BoxCardInfo>
                <BoxDeleteIcon onClick={(e) => e.stopPropagation()}>
                  <TrashIcon
                    style={{ color: '#ff4d4f', cursor: 'pointer', fontSize: 16 }}
                    onClick={() => handleDeleteBox(box)}
                  />
                </BoxDeleteIcon>
              </BoxCard>
            ))}
          </BoxGrid>
        )}
      </Card>

      <Card>
        <CardHeader>
          标签管理
        {tagDeleteMode ? (
          <Button
            size="small"
            onClick={() => {
              setTagDeleteMode(false);
              setSelectedTagIds(new Set());
            }}
          >
            <CloseOutline /> 取消
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" onClick={handleAddTag}>
              <AddOutline />
            </Button>
            {tags.length > 0 && (
              <Button size="small" onClick={() => setTagDeleteMode(true)}>
                <TrashIcon style={{ color: '#ff4d4f' }} />
              </Button>
            )}
          </div>
        )}
        </CardHeader>
        {tags.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
            暂无标签
          </div>
        ) : (
          <TagList>
            {tags.map((tag) => (
              <TagBadge
                key={tag.tag_id}
                $selected={tagDeleteMode && selectedTagIds.has(tag.tag_id)}
                onClick={() => handleRenameTag(tag)}
              >
                {tag.tag_name}
              </TagBadge>
            ))}
          </TagList>
        )}
        {tagDeleteMode && (
          <DeleteBar>
            <Button
              block
              onClick={() => {
                setTagDeleteMode(false);
                setSelectedTagIds(new Set());
              }}
            >
              取消
            </Button>
            <Button
              block
              color="danger"
              onClick={handleConfirmDeleteTags}
              disabled={selectedTagIds.size === 0}
            >
              确认删除{selectedTagIds.size > 0 ? ` (${selectedTagIds.size})` : ''}
            </Button>
          </DeleteBar>
        )}
      </Card>

      <Card>
        <CardHeader>
          成员管理
          <span style={{ fontWeight: 400, color: '#999', fontSize: 13 }}>
            ({members.length}人)
          </span>
        </CardHeader>
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
      </Card>

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
