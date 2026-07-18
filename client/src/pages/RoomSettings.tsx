import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
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
import { useTranslation } from 'react-i18next';
import { roomApi, boxApi, tagApi } from '../services/api';
import { useRoomStore } from '../stores/roomStore';
import { useAuthStore } from '../stores/authStore';
import TrashIcon from '../components/icons/TrashIcon';

const Container = styled.div`
  min-height: 100vh;
  background: var(--app-color-bg);
`;

const Header = styled.div`
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--app-color-surface);
  padding: 8px 16px;
  border-bottom: 1px solid var(--app-color-border);
  display: flex;
  align-items: center;
`;

const BackButton = styled.span`
  font-size: 20px;
  cursor: pointer;
  margin-right: 12px;
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
`;

const Content = styled.div`
  padding: 12px 16px;
`;

const Card = styled.div`
  background: var(--app-color-surface);
  border-radius: var(--app-radius-l);
  margin-bottom: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px var(--app-shadow-card);
`;

const CardHeader = styled.div`
  padding: 14px 16px 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--app-color-text);
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
  color: var(--app-color-text);
`;

const EditIconButton = styled.button`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--app-color-primary);
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
  color: var(--app-color-text-secondary);
`;

const RequestGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 12px 16px;
`;

const RequestCard = styled.div`
  background: var(--app-color-hover);
  border-radius: var(--app-radius-m);
  padding: 12px;
`;

const RequestCardTop = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
`;

const RequestAvatar = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 8px;
  flex-shrink: 0;
`;

const RequestAvatarPlaceholder = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--app-color-placeholder);
  margin-right: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--app-color-text-secondary);
`;

const RequestCardInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const RequestCardName = styled.div`
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RequestCardMeta = styled.div`
  font-size: 12px;
  color: var(--app-color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RequestCardButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const MemberGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 12px 16px;
`;

const MemberCard = styled.div`
  background: var(--app-color-hover);
  border-radius: var(--app-radius-m);
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const MemberCardLeft = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
`;

const MemberAvatar = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 8px;
  flex-shrink: 0;
`;

const MemberAvatarPlaceholder = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--app-color-placeholder);
  margin-right: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--app-color-text-secondary);
`;

const MemberCardInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const MemberCardName = styled.div`
  font-size: 14px;
  word-break: break-all;
`;

const MemberCardMeta = styled.div`
  font-size: 12px;
  color: var(--app-color-text-secondary);
  word-break: break-all;
`;

const MemberAdminBadge = styled.span`
  display: inline-block;
  margin-left: 4px;
  padding: 0 6px;
  font-size: 11px;
  border-radius: var(--app-radius-s);
  vertical-align: middle;
`;

const BoxGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 12px 16px;
`;

const BoxCard = styled.div`
  background: var(--app-color-hover);
  border-radius: var(--app-radius-m);
  padding: 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;

  &:active {
    background: var(--app-color-border);
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
  color: var(--app-color-text-secondary);
  margin-top: 4px;
`;

const BoxDeleteIcon = styled.div`
  flex-shrink: 0;
  margin-left: 8px;
`;

const ItemCountBadge = styled.span`
  background: var(--app-color-danger);
  color: var(--app-color-surface);
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
  border-radius: var(--app-radius-s);
  cursor: pointer;
  transition: all 0.2s;
  background: ${(props) => (props.$selected ? 'var(--app-color-danger)' : 'var(--app-color-info-bg)')};
  color: ${(props) => (props.$selected ? 'var(--app-color-surface)' : 'var(--app-color-primary)')};
`;

const DeleteBar = styled.div`
  display: flex;
  gap: 12px;
  padding: 8px 16px;
  border-top: 1px solid var(--app-color-border);
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
  user_avatar?: string;
  is_admin?: boolean;
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
  const { t } = useTranslation();
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
  const [memberDeleteMode, setMemberDeleteMode] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [adminEditSelection, setAdminEditSelection] = useState<Set<number>>(new Set());
  const [transferMode, setTransferMode] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(null);

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
      Toast.show({ icon: 'fail', content: t('roomSettings.loadFailed') });
    } finally {
      setLoading(false);
    }
  };

  const handleEditRoom = async () => {
    const result = await Dialog.confirm({
      title: t('roomSettings.editRoomName'),
      content: (
        <Input
          id="roomName"
          placeholder={t('roomSettings.editRoomName')}
          defaultValue={room?.room_name}
          style={{ marginTop: 8 }}
        />
      ),
    });

    if (result) {
      const name = (document.getElementById('roomName') as HTMLInputElement)?.value;
      if (!name) {
        Toast.show({ content: t('roomSettings.nameRequired') });
        return;
      }

      try {
        await roomApi.update(parseInt(id!), { name });
        setRoom({ ...room, room_name: name });
        updateRoom(parseInt(id!), { room_name: name });
        Toast.show({ icon: 'success', content: t('roomSettings.editSuccess') });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || t('roomSettings.editFailed') });
      }
    }
  };

  const handleAddBox = () => {
    navigate(`/add-box/${id}`);
  };

  const handleRenameBox = async (box: Box) => {
    const result = await Dialog.confirm({
      title: t('roomSettings.editBoxName'),
      content: (
        <Input
          id="boxRenameInput"
          placeholder={t('roomSettings.editBoxName')}
          defaultValue={box.box_name || ''}
          style={{ marginTop: 8 }}
        />
      ),
    });

    if (result) {
      const name = (document.getElementById('boxRenameInput') as HTMLInputElement)?.value;
      if (!name) {
        Toast.show({ content: t('roomSettings.nameRequired') });
        return;
      }

      try {
        await boxApi.update(box.box_id, { name });
        setBoxes(boxes.map((b) => b.box_id === box.box_id ? { ...b, box_name: name } : b));
        Toast.show({ icon: 'success', content: t('roomSettings.editSuccess') });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || t('roomSettings.editFailed') });
      }
    }
  };

  const handleDeleteBox = async (box: Box) => {
    const itemCount = box.item_count || 0;
    const isLastBox = boxes.length <= 1;

    // 如果是最后一个盒子，不允许删除
    if (isLastBox) {
      Toast.show({ content: t('roomSettings.cannotDeleteLastBox') });
      return;
    }

    // 如果盒子中没有物品，直接删除
    if (itemCount === 0) {
      const result = await Dialog.confirm({
        content: t('roomSettings.confirmDeleteBox', { name: box.box_name || t('roomSettings.boxId', { id: box.box_id }) }),
      });

      if (result) {
        try {
          await boxApi.delete(box.box_id);
          setBoxes(boxes.filter((b) => b.box_id !== box.box_id));
          Toast.show({ icon: 'success', content: t('roomSettings.deleteSuccess') });
        } catch (error: any) {
          Toast.show({ icon: 'fail', content: error.message || t('roomSettings.deleteFailed') });
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
      Toast.show({ content: t('roomSettings.selectMoveTarget') });
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
      Toast.show({ icon: 'success', content: t('roomSettings.deleteSuccess') });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('roomSettings.deleteFailed') });
    }
  };

  const handleAddTag = async () => {
    const result = await Dialog.confirm({
      title: t('roomSettings.addTag'),
      content: (
        <Input
          id="tagName"
          placeholder={t('roomSettings.addTag')}
          style={{ marginTop: 8 }}
        />
      ),
    });

    if (result) {
      const name = (document.getElementById('tagName') as HTMLInputElement)?.value;
      if (!name) {
        Toast.show({ content: t('roomSettings.tagNameRequired') });
        return;
      }

      try {
        const res: any = await tagApi.create(parseInt(id!), name);
        setTags([...tags, res.data]);
        Toast.show({ icon: 'success', content: t('roomSettings.addSuccess') });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || t('roomSettings.addFailed') });
      }
    }
  };

  const handleRenameTag = async (tag: Tag) => {
    if (tagDeleteMode) {
      toggleTagSelection(tag.tag_id);
      return;
    }

    const result = await Dialog.confirm({
      title: t('roomSettings.editTagName'),
      content: (
        <Input
          id="tagRenameInput"
          placeholder={t('roomSettings.editTagName')}
          defaultValue={tag.tag_name}
          style={{ marginTop: 8 }}
        />
      ),
    });

    if (result) {
      const name = (document.getElementById('tagRenameInput') as HTMLInputElement)?.value;
      if (!name) {
        Toast.show({ content: t('roomSettings.tagNameRequired') });
        return;
      }

      try {
        await tagApi.update(tag.tag_id, name);
        setTags(tags.map((t) => t.tag_id === tag.tag_id ? { ...t, tag_name: name } : t));
        Toast.show({ icon: 'success', content: t('roomSettings.editSuccess') });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || t('roomSettings.editFailed') });
      }
    }
  };

  const handleConfirmDeleteTags = async () => {
    if (selectedTagIds.size === 0) {
      Toast.show({ content: t('roomSettings.selectTagsToDelete') });
      return;
    }
    try {
      await Promise.all(Array.from(selectedTagIds).map((id) => tagApi.delete(id)));
      setTags(tags.filter((t) => !selectedTagIds.has(t.tag_id)));
      setSelectedTagIds(new Set());
      setTagDeleteMode(false);
      Toast.show({ icon: 'success', content: t('roomSettings.deleteSuccess') });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('roomSettings.deleteFailed') });
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

  const toggleMemberSelection = (userId: number) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleConfirmDeleteMembers = async () => {
    if (selectedMemberIds.size === 0) {
      Toast.show({ content: t('roomSettings.selectMembersToRemove') });
      return;
    }
    try {
      await Promise.all(
        Array.from(selectedMemberIds).map((userId) => roomApi.removeMember(parseInt(id!), userId))
      );
      setMembers(members.filter((m) => !selectedMemberIds.has(m.member_user_id)));
      setSelectedMemberIds(new Set());
      setMemberDeleteMode(false);
      Toast.show({ icon: 'success', content: t('roomSettings.removeSuccess') });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('roomSettings.removeFailed') });
    }
  };

  const enterAdminEditMode = () => {
    // Initialize selection to current non-primary admins
    const initial = new Set<number>();
    members.forEach((m) => {
      if (m.member_user_id !== room?.room_admin && m.is_admin) {
        initial.add(m.member_user_id);
      }
    });
    setAdminEditSelection(initial);
    setAdminEditMode(true);
  };

  const toggleAdminSelection = (userId: number) => {
    setAdminEditSelection((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleConfirmAdmins = async () => {
    const target = new Set(adminEditSelection);
    const currentNonPrimary = new Set(
      members.filter((m) => m.member_user_id !== room?.room_admin && m.is_admin).map((m) => m.member_user_id)
    );
    const toAdd = Array.from(target).filter((u) => !currentNonPrimary.has(u));
    const toRemove = Array.from(currentNonPrimary).filter((u) => !target.has(u));
    if (toAdd.length === 0 && toRemove.length === 0) {
      setAdminEditMode(false);
      return;
    }
    try {
      await Promise.all([
        ...toAdd.map((u) => roomApi.addAdmin(parseInt(id!), u)),
        ...toRemove.map((u) => roomApi.removeAdmin(parseInt(id!), u)),
      ]);
      setMembers(members.map((m) =>
        m.member_user_id === room?.room_admin
          ? m
          : { ...m, is_admin: target.has(m.member_user_id) }
      ));
      setAdminEditMode(false);
      setAdminEditSelection(new Set());
      Toast.show({ icon: 'success', content: t('roomSettings.adminEditSuccess') });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('roomSettings.operationFailed') });
    }
  };

  const enterTransferMode = () => {
    setAdminEditMode(false);
    setAdminEditSelection(new Set());
    setTransferMode(true);
    setSelectedTransferId(null);
  };

  const handleConfirmTransfer = async () => {
    if (selectedTransferId == null) return;
    const target = members.find((m) => m.member_user_id === selectedTransferId);
    const targetName = target?.member_name || target?.user_nickname || '';
    const c1 = await Dialog.confirm({
      content: t('roomSettings.transferConfirm1', { name: targetName }),
    });
    if (!c1) return;
    const c2 = await Dialog.confirm({
      content: t('roomSettings.transferConfirm2'),
    });
    if (!c2) return;
    try {
      await roomApi.transferPrimaryAdmin(parseInt(id!), selectedTransferId);
      // Update local state: new primary, old primary (current user) becomes admin
      setMembers(members.map((m) => {
        if (m.member_user_id === selectedTransferId) return { ...m, is_admin: false };
        if (m.member_user_id === room?.room_admin) return { ...m, is_admin: true };
        return m;
      }));
      setRoom({ ...room, room_admin: selectedTransferId });
      setTransferMode(false);
      setSelectedTransferId(null);
      Toast.show({ icon: 'success', content: t('roomSettings.transferSuccess') });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('roomSettings.operationFailed') });
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
      Toast.show({ icon: 'success', content: t('roomSettings.approved') });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('roomSettings.operationFailed') });
    }
  };

  const handleRejectRequest = async (request: JoinRequest) => {
    const result = await Dialog.confirm({
      content: t('roomSettings.confirmReject', { name: request.user_nickname }),
    });

    if (result) {
      try {
        await roomApi.rejectJoinRequest(parseInt(id!), request.request_id);
        setJoinRequests(joinRequests.filter((r) => r.request_id !== request.request_id));
        Toast.show({ icon: 'success', content: t('roomSettings.rejected') });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || t('roomSettings.operationFailed') });
      }
    }
  };

  if (loading) {
    return (
      <Container>
        <Header>
          <BackButton onClick={() => navigate(-1)}>←</BackButton>
          <HeaderTitle>{t('roomSettings.title')}</HeaderTitle>
        </Header>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <SpinLoading />
        </div>
      </Container>
    );
  }

  // 权限检查：只有管理员可以访问
  if (!room || !room.is_admin) {
    return (
      <Container>
        <Header>
          <BackButton onClick={() => navigate(-1)}>←</BackButton>
          <HeaderTitle>{t('roomSettings.title')}</HeaderTitle>
        </Header>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--app-color-text-secondary)' }}>
          {t('roomSettings.notAdmin')}
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>{t('roomSettings.title')}</HeaderTitle>
      </Header>
      <Content>

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
            {t('roomSettings.joinRequests')}
            <span style={{ fontWeight: 400, color: 'var(--app-color-danger)', fontSize: 13 }}>
              {t('roomSettings.pendingCount', { count: joinRequests.length })}
            </span>
          </CardHeader>
          <RequestGrid>
            {joinRequests.map((request) => (
              <RequestCard key={request.request_id}>
                <RequestCardTop>
                  {request.user_avatar ? (
                    <RequestAvatar src={request.user_avatar} alt="" />
                  ) : (
                    <RequestAvatarPlaceholder>
                      {(request.request_member_name || request.user_nickname)?.charAt(0) || '?'}
                    </RequestAvatarPlaceholder>
                  )}
                  <RequestCardInfo>
                    <RequestCardName>
                      {request.request_member_name || request.user_nickname}
                    </RequestCardName>
                    <RequestCardMeta>
                      @{request.user_login_name} · {new Date(Number(request.request_create_time)).toLocaleDateString()}
                    </RequestCardMeta>
                  </RequestCardInfo>
                </RequestCardTop>
                <RequestCardButtons>
                  <Button
                    size="small"
                    color="primary"
                    style={{ flex: 1 }}
                    onClick={() => handleApproveRequest(request)}
                  >
                    <CheckCircleOutline /> {t('roomSettings.approve')}
                  </Button>
                  <Button
                    size="small"
                    color="danger"
                    style={{ flex: 1 }}
                    onClick={() => handleRejectRequest(request)}
                  >
                    <CloseCircleOutline /> {t('roomSettings.reject')}
                  </Button>
                </RequestCardButtons>
              </RequestCard>
            ))}
          </RequestGrid>
        </Card>
      )}

      <Card>
        <CardHeader>
          {t('roomSettings.boxManagement')}
          <Button size="small" onClick={handleAddBox}>
            <AddOutline /> {t('roomSettings.add')}
          </Button>
        </CardHeader>
        {boxes.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--app-color-text-secondary)' }}>
            {t('roomSettings.noBoxes')}
          </div>
        ) : (
          <BoxGrid>
            {boxes.map((box) => (
              <BoxCard key={box.box_id} onClick={() => handleRenameBox(box)}>
                <BoxCardInfo>
                  <BoxCardName>
                    {box.box_name || t('roomSettings.boxId', { id: box.box_id })}
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
                    style={{ color: 'var(--app-color-danger)', cursor: 'pointer', fontSize: 16 }}
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
          {t('roomSettings.tagManagement')}
        {tagDeleteMode ? (
          <Button
            size="small"
            onClick={() => {
              setTagDeleteMode(false);
              setSelectedTagIds(new Set());
            }}
          >
            <CloseOutline /> {t('common.cancel')}
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" onClick={handleAddTag}>
              <AddOutline />
            </Button>
            {tags.length > 0 && (
              <Button size="small" onClick={() => setTagDeleteMode(true)}>
                <TrashIcon style={{ color: 'var(--app-color-danger)' }} />
              </Button>
            )}
          </div>
        )}
        </CardHeader>
        {tags.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--app-color-text-secondary)' }}>
            {t('roomSettings.noTags')}
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
              {t('common.cancel')}
            </Button>
            <Button
              block
              color="danger"
              onClick={handleConfirmDeleteTags}
              disabled={selectedTagIds.size === 0}
            >
              {t('roomSettings.confirmDelete', { count: selectedTagIds.size > 0 ? ` (${selectedTagIds.size})` : '' })}
            </Button>
          </DeleteBar>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {t('roomSettings.memberManagement')}
            <span style={{ fontWeight: 400, color: 'var(--app-color-text-secondary)', fontSize: 13, marginLeft: 6 }}>
              {t('roomSettings.memberCount', { count: members.length })}
            </span>
          </div>
          {memberDeleteMode ? (
            <Button
              size="small"
              onClick={() => {
                setMemberDeleteMode(false);
                setSelectedMemberIds(new Set());
              }}
            >
              <CloseOutline /> {t('common.cancel')}
            </Button>
          ) : adminEditMode ? (
            <Button
              size="small"
              onClick={() => {
                setAdminEditMode(false);
                setAdminEditSelection(new Set());
              }}
            >
              <CloseOutline /> {t('common.cancel')}
            </Button>
          ) : transferMode ? (
            <Button
              size="small"
              onClick={() => {
                setTransferMode(false);
                setSelectedTransferId(null);
              }}
            >
              <CloseOutline /> {t('common.cancel')}
            </Button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {room?.room_admin === user?.user_id && (
                <Button size="small" onClick={enterAdminEditMode}>
                  {t('roomSettings.adminManagement')}
                </Button>
              )}
              <Button size="small" onClick={() => setMemberDeleteMode(true)}>
                <TrashIcon style={{ color: 'var(--app-color-danger)' }} />
              </Button>
            </div>
          )}
        </CardHeader>
        {members.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--app-color-text-secondary)' }}>
            {t('roomSettings.noMembers')}
          </div>
        ) : (
          <>
            {adminEditMode && (
              <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--app-color-text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{t('roomSettings.adminEditHint')}</span>
                <Button size='mini' onClick={enterTransferMode}>→ {t('roomSettings.transferPrimaryAdmin')}</Button>
              </div>
            )}
            {transferMode && (
              <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--app-color-info)', fontWeight: 500 }}>
                {t('roomSettings.transferHint')}
              </div>
            )}
            <MemberGrid>
            {members.map((member) => {
                const isPrimary = member.member_user_id === room?.room_admin;
                const isSelected = transferMode
                  ? selectedTransferId === member.member_user_id
                  : adminEditMode && (isPrimary || adminEditSelection.has(member.member_user_id));
                const isSelectable = transferMode
                  ? !isPrimary
                  : adminEditMode && !isPrimary;
                const isDeleteSelected = memberDeleteMode && selectedMemberIds.has(member.member_user_id);
                const isDeleteSelectable = memberDeleteMode && member.member_user_id !== room?.room_admin && (!member.is_admin || room?.room_admin === user?.user_id);
                const cardBackground = transferMode
                  ? (isSelected ? 'var(--app-color-success)' : 'var(--app-color-hover)')
                  : adminEditMode
                    ? (isSelected ? 'var(--app-color-primary)' : 'var(--app-color-hover)')
                    : isDeleteSelected
                      ? 'var(--app-color-danger)'
                      : isDeleteSelectable
                        ? 'var(--app-color-hover)'
                        : undefined;
                const showPointer = transferMode ? isSelectable : adminEditMode ? isSelectable : !!isDeleteSelectable;
                const handleClick = transferMode
                  ? (isSelectable ? () => setSelectedTransferId(member.member_user_id) : undefined)
                  : adminEditMode
                    ? (isSelectable ? () => toggleAdminSelection(member.member_user_id) : undefined)
                    : isDeleteSelectable
                      ? () => toggleMemberSelection(member.member_user_id)
                      : undefined;
                return (
                  <MemberCard
                    key={member.member_id}
                    style={cardBackground ? { background: cardBackground, ...(showPointer ? { cursor: 'pointer' } : {}) } : undefined}
                    onClick={handleClick}
                  >
                    <MemberCardLeft>
                      {member.user_avatar ? (
                        <MemberAvatar src={member.user_avatar} alt="" />
                      ) : (
                        <MemberAvatarPlaceholder style={(isSelected || isDeleteSelected) ? { background: 'var(--app-color-placeholder)' } : undefined}>
                          {(member.member_name || member.user_nickname)?.charAt(0) || '?'}
                        </MemberAvatarPlaceholder>
                      )}
                      <MemberCardInfo>
                        <MemberCardName style={(isSelected || isDeleteSelected) ? { color: 'var(--app-color-surface)' } : undefined}>
                          {member.member_name || member.user_nickname}
                          {(isPrimary || member.is_admin) && (
                            <MemberAdminBadge
                              style={{
                                background: isPrimary
                                  ? 'var(--app-color-primary)'
                                  : 'var(--app-color-info-bg, rgba(0,122,255,0.1))',
                                color: isPrimary
                                  ? '#fff'
                                  : 'var(--app-color-primary)',
                              }}
                            >
                              {isPrimary ? t('roomSettings.primaryAdmin') : t('roomSettings.adminBadge')}
                            </MemberAdminBadge>
                          )}
                        </MemberCardName>
                        <MemberCardMeta style={(isSelected || isDeleteSelected) ? { color: 'var(--app-color-surface)' } : undefined}>
                          @{member.user_login_name}
                        </MemberCardMeta>
                      </MemberCardInfo>
                    </MemberCardLeft>
                  </MemberCard>
                );
              })}
          </MemberGrid>
          </>
        )}
        {memberDeleteMode && (
          <DeleteBar>
            <Button
              block
              onClick={() => {
                setMemberDeleteMode(false);
                setSelectedMemberIds(new Set());
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              block
              color="danger"
              onClick={handleConfirmDeleteMembers}
              disabled={selectedMemberIds.size === 0}
            >
              {t('roomSettings.confirmDelete', { count: selectedMemberIds.size > 0 ? ` (${selectedMemberIds.size})` : '' })}
            </Button>
          </DeleteBar>
        )}
        {adminEditMode && (
          <DeleteBar>
            <Button
              block
              onClick={() => {
                setAdminEditMode(false);
                setAdminEditSelection(new Set());
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              block
              color="primary"
              onClick={handleConfirmAdmins}
            >
              {t('common.confirm')}
            </Button>
          </DeleteBar>
        )}
        {transferMode && (
          <DeleteBar>
            <Button
              block
              onClick={() => {
                setTransferMode(false);
                setSelectedTransferId(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              block
              color="primary"
              onClick={handleConfirmTransfer}
              disabled={selectedTransferId == null}
            >
              {t('common.confirm')}
            </Button>
          </DeleteBar>
        )}
      </Card>
      </Content>

      {/* 删除盒子弹窗 */}
      <Popup
        visible={deleteBoxPopup.visible}
        onMaskClick={() => setDeleteBoxPopup({ visible: false, box: null, targetValue: '' })}
        bodyStyle={{ borderRadius: '16px 16px 0 0' }}
      >
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            {t('roomSettings.deleteBox')}
          </div>
          <div style={{ marginBottom: 12, color: 'var(--app-color-text-weak)' }}>
            {t('roomSettings.boxHasItems', { name: deleteBoxPopup.box?.box_name || t('roomSettings.boxId', { id: deleteBoxPopup.box?.box_id }), count: deleteBoxPopup.box?.item_count || 0 })}
          </div>
          <Selector
            options={[
              ...boxes
                .filter((b) => b.box_id !== deleteBoxPopup.box?.box_id)
                .map((b) => ({
                  label: b.box_name || t('roomSettings.boxId', { id: b.box_id }),
                  value: `box_${b.box_id}`,
                })),
              { label: t('roomSettings.userHand'), value: 'user_hand' },
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
              {t('common.cancel')}
            </Button>
            <Button
              block
              color="danger"
              onClick={confirmDeleteBox}
              disabled={!deleteBoxPopup.targetValue}
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </Popup>
    </Container>
  );
}
