import { useEffect, useState } from 'react';
import { Popup, Button, Input, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { itemApi, tagApi, reservationApi } from '../services/api';
import { useCartStore } from '../stores/cartStore';

const PopupContent = styled.div`
  position: relative;
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
`;

const ItemHeader = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
`;

const ItemImage = styled.div<{ $image?: string }>`
  width: 80px;
  height: 80px;
  border-radius: 8px;
  background: ${(props) =>
    props.$image ? `url(${props.$image}) center/cover` : '#f0f0f0'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
`;

const ItemTitle = styled.div`
  flex: 1;
`;

const ItemName = styled.div`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
`;

const ItemMeta = styled.div`
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
`;

const StockBadge = styled.span<{ $inStock: boolean }>`
  display: inline-block;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 8px;
  background: ${(props) => (props.$inStock ? '#e6f7e6' : '#fff0f0')};
  color: ${(props) => (props.$inStock ? '#52c41a' : '#ff4d4f')};
`;

const Section = styled.div`
  margin-bottom: 20px;
`;

const SectionTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
`;

const HistoryItem = styled.div`
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
`;

const CommentItem = styled.div`
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
`;

const CommentUser = styled.div`
  font-weight: 500;
  margin-bottom: 4px;
`;

const CommentContent = styled.div`
  font-size: 14px;
  color: #333;
`;

const CommentTime = styled.div`
  font-size: 12px;
  color: #999;
  margin-top: 4px;
`;

const CommentInput = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

interface ItemDetailProps {
  visible: boolean;
  itemId: number | null;
  roomId?: number; // 当前查看的仓库ID
  isOwner?: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function ItemDetail({
  visible,
  itemId,
  roomId,
  isOwner,
  onClose,
  onUpdate,
}: ItemDetailProps) {
  const [item, setItem] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [allTags, setAllTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [editingTags, setEditingTags] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [editingRemark, setEditingRemark] = useState(false);
  const [editRemarkText, setEditRemarkText] = useState('');
  const { addItem, items: cartItems } = useCartStore();

  const isInCart = cartItems.some((i) => i.itemId === itemId);

  useEffect(() => {
    if (visible && itemId) {
      loadItem();
      loadHistory();
      loadComments();
      loadReservations();
    }
  }, [visible, itemId, roomId]);

  // 当 item 加载完成后，加载该仓库的所有标签
  useEffect(() => {
    if (item?.room_id) {
      loadAllTags(item.room_id);
    }
  }, [item?.room_id]);

  const loadItem = async () => {
    try {
      const res: any = await itemApi.getById(itemId!, roomId);
      setItem(res.data);
      setEditName(res.data.item_name);
      // 初始化已选标签
      if (res.data.tags) {
        setSelectedTagIds(res.data.tags.map((t: any) => t.tag_id));
      }
    } catch (error) {
      console.error('Failed to load item:', error);
    }
  };

  const loadAllTags = async (roomId: number) => {
    try {
      const res: any = await tagApi.getByRoom(roomId);
      setAllTags(res.data || []);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const res: any = await itemApi.getHistory(itemId!);
      setHistory(res.data);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const loadComments = async () => {
    try {
      const res: any = await itemApi.getComments(itemId!);
      setComments(res.data);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const loadReservations = async () => {
    try {
      const res: any = await reservationApi.getByItem(itemId!);
      setReservations(res.data || []);
    } catch (error) {
      console.error('Failed to load reservations:', error);
    }
  };

  const handleUpdateName = async () => {
    if (!editName.trim()) {
      Toast.show({ content: '物品名称不能为空' });
      return;
    }
    try {
      await itemApi.update(itemId!, { name: editName });
      setItem({ ...item, item_name: editName });
      setEditing(false);
      Toast.show({ icon: 'success', content: '更新成功' });
      onUpdate?.();
    } catch (error) {
      Toast.show({ icon: 'fail', content: '更新失败' });
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      Toast.show({ content: '评论内容不能为空' });
      return;
    }
    try {
      await itemApi.addComment(itemId!, commentText);
      setCommentText('');
      loadComments();
      Toast.show({ icon: 'success', content: '评论成功' });
    } catch (error) {
      Toast.show({ icon: 'fail', content: '评论失败' });
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSaveTags = async () => {
    if (!item?.room_id) return;
    try {
      await itemApi.setTags(itemId!, item.room_id, selectedTagIds);
      // 更新本地 item 数据
      const newTags = allTags.filter((t) => selectedTagIds.includes(t.tag_id));
      setItem({ ...item, tags: newTags });
      setEditingTags(false);
      Toast.show({ icon: 'success', content: '标签已更新' });
      onUpdate?.();
    } catch (error) {
      Toast.show({ icon: 'fail', content: '更新失败' });
    }
  };

  const handleAddToCart = () => {
    if (!item) return;
    addItem({
      itemId: item.item_id,
      itemName: item.remark || item.item_name,
      itemQrcode: item.item_qrcode,
      itemImage: item.item_image,
      boxName: item.box_name,
      roomName: item.room_name,
    });
    Toast.show({ icon: 'success', content: '已添加到购物车' });
  };

  const handleSaveRemark = async () => {
    if (!item?.room_id) return;
    try {
      await itemApi.setRemark(itemId!, item.room_id, editRemarkText);
      setItem({ ...item, remark: editRemarkText || null });
      setEditingRemark(false);
      Toast.show({ icon: 'success', content: '备注名已更新' });
      onUpdate?.();
    } catch (error) {
      Toast.show({ icon: 'fail', content: '更新失败' });
    }
  };

  const formatTime = (timestamp: number | string) => {
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    if (!ts || isNaN(ts)) return '未知时间';
    return new Date(ts).toLocaleString('zh-CN');
  };

  return (
    <>
      <Popup
      visible={visible}
      onMaskClick={onClose}
      bodyStyle={{ height: '80vh', borderRadius: '12px 12px 0 0' }}
    >
      <PopupContent>
        {item && (
          <>
            <div style={{ position: 'absolute', top: 16, right: 16 }}>
              <Button
                color={isInCart ? 'default' : 'primary'}
                size="small"
                onClick={handleAddToCart}
                disabled={isInCart}
              >
                {isInCart ? '已预约' : '预约'}
              </Button>
            </div>
            <ItemHeader>
              <ItemImage $image={item.item_image}>
                {!item.item_image && '📦'}
              </ItemImage>
              <ItemTitle>
                {editing ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input
                      value={editName}
                      onChange={setEditName}
                      placeholder="物品名称"
                      style={{ flex: 1 }}
                    />
                    <Button size="small" onClick={handleUpdateName}>
                      保存
                    </Button>
                    <Button size="small" onClick={() => setEditing(false)}>
                      取消
                    </Button>
                  </div>
                ) : (
                  <ItemName>
                    <span>{item.remark || item.item_name}</span>
                    {item.room_id && (
                      <span
                        onClick={() => {
                          setEditRemarkText(item.remark || '');
                          setEditingRemark(true);
                        }}
                        style={{
                          marginLeft: 8,
                          cursor: 'pointer',
                          color: '#1677ff',
                          fontSize: 14,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </span>
                    )}
                    {isOwner && (
                      <Button
                        size="mini"
                        style={{ marginLeft: 8 }}
                        onClick={() => setEditing(true)}
                      >
                        编辑名称
                      </Button>
                    )}
                  </ItemName>
                )}
                <ItemMeta>创建于 {formatTime(item.item_create_time)}</ItemMeta>
                <ItemMeta>
                  当前位置: {item.display_location_name || item.current_room_name || '未知仓库'}
                  {item.current_box_name && ` / ${item.current_box_name}`}
                  {item.is_in_stock !== undefined && (
                    <StockBadge $inStock={item.is_in_stock || item.is_foreign}>
                      {item.is_foreign ? '外来物品' : (item.is_in_stock ? '在库' : '离库')}
                    </StockBadge>
                  )}
                </ItemMeta>
                {item.is_foreign && (
                  <ItemMeta>
                    应归还到: {item.belong_room_name || item.room_name}{item.belong_box_name && ` / ${item.belong_box_name}`}
                  </ItemMeta>
                )}
                {!item.is_in_stock && !item.is_foreign && (
                  <ItemMeta>
                    应归还到: {item.belong_room_name || item.room_name}{item.belong_box_name && ` / ${item.belong_box_name}`}
                    {item.holder_nickname && ` (正在: ${item.holder_nickname})`}
                  </ItemMeta>
                )}
                {item.owner_nickname && (
                  <ItemMeta>所有者: {item.owner_nickname}</ItemMeta>
                )}
              </ItemTitle>
            </ItemHeader>

            {item.remark && (
              <Section>
                <SectionTitle>备注</SectionTitle>
                <div style={{ fontSize: 14, color: '#666' }}>{item.remark}</div>
              </Section>
            )}

            <Section>
              <SectionTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                标签
                {item.room_id && !editingTags && (
                  <Button size="mini" onClick={() => setEditingTags(true)}>
                    编辑
                  </Button>
                )}
              </SectionTitle>
              {editingTags ? (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {allTags.length === 0 ? (
                      <span style={{ color: '#999', fontSize: 13 }}>暂无标签可选，请先在仓库设置中创建标签</span>
                    ) : (
                      allTags.map((tag: any) => (
                        <span
                          key={tag.tag_id}
                          onClick={() => toggleTag(tag.tag_id)}
                          style={{
                            padding: '4px 12px',
                            background: selectedTagIds.includes(tag.tag_id) ? '#1677ff' : '#f5f5f5',
                            color: selectedTagIds.includes(tag.tag_id) ? '#fff' : '#666',
                            borderRadius: 4,
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          {tag.tag_name}
                        </span>
                      ))
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button size="small" color="primary" onClick={handleSaveTags}>
                      保存
                    </Button>
                    <Button size="small" onClick={() => {
                      setEditingTags(false);
                      // 恢复原始选中状态
                      if (item.tags) {
                        setSelectedTagIds(item.tags.map((t: any) => t.tag_id));
                      }
                    }}>
                      取消
                    </Button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {item.tags && item.tags.length > 0 ? (
                    item.tags.map((tag: any) => (
                      <span
                        key={tag.tag_id}
                        style={{
                          padding: '4px 12px',
                          background: '#e6f4ff',
                          color: '#1677ff',
                          borderRadius: 4,
                          fontSize: 13,
                        }}
                      >
                        {tag.tag_name}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: '#999', fontSize: 13 }}>暂无标签</span>
                  )}
                </div>
              )}
            </Section>

            {reservations.length > 0 && (
              <Section>
                <SectionTitle>预约记录</SectionTitle>
                {reservations.map((r) => (
                  <HistoryItem key={r.reservation_id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500 }}>{r.user_nickname}</span>
                      <span style={{
                        fontSize: 12,
                        padding: '2px 8px',
                        background: r.reservation_start_time > Date.now() ? '#fff7e6' : '#e6f7e6',
                        color: r.reservation_start_time > Date.now() ? '#fa8c16' : '#52c41a',
                        borderRadius: 4
                      }}>
                        {r.reservation_start_time > Date.now() ? '待使用' : '使用中'}
                      </span>
                    </div>
                    <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                      {formatTime(r.reservation_start_time)} ~ {formatTime(r.reservation_end_time)}
                    </div>
                  </HistoryItem>
                ))}
              </Section>
            )}

            {history.length > 0 && (
              <Section>
                <SectionTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  转移记录
                  {history.length > 3 && (
                    <Button size="mini" onClick={() => setShowAllHistory(true)}>更多</Button>
                  )}
                </SectionTitle>
                {history.slice(0, 3).map((h) => (
                  <HistoryItem key={h.history_id}>
                    <div>
                      {h.user_nickname} 移动到 {h.box_name}
                    </div>
                    <div style={{ color: '#999', fontSize: 12 }}>
                      {formatTime(h.history_time)}
                    </div>
                  </HistoryItem>
                ))}
              </Section>
            )}

            <Section>
              <SectionTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                评论 ({comments.length})
                {comments.length > 5 && (
                  <Button size="mini" onClick={() => setShowAllComments(true)}>更多</Button>
                )}
              </SectionTitle>
              <CommentInput>
                <Input
                  value={commentText}
                  onChange={setCommentText}
                  placeholder="添加评论..."
                  style={{ flex: 1 }}
                />
                <Button color="primary" size="small" onClick={handleAddComment}>
                  发送
                </Button>
              </CommentInput>
              {comments.slice(0, 5).map((c) => (
                <CommentItem key={c.comment_id}>
                  <CommentUser>{c.user_nickname}</CommentUser>
                  <CommentContent>{c.comment_content}</CommentContent>
                  <CommentTime>{formatTime(c.comment_create_time)}</CommentTime>
                </CommentItem>
              ))}
            </Section>
          </>
        )}
      </PopupContent>
    </Popup>

      {/* 转移记录完整列表弹窗 */}
      <Popup
        visible={showAllHistory}
        onMaskClick={() => setShowAllHistory(false)}
        bodyStyle={{ height: '60vh', borderRadius: '12px 12px 0 0', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
          <SectionTitle style={{ marginBottom: 16 }}>转移记录 (全部 {history.length} 条)</SectionTitle>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
          {history.map((h) => (
            <HistoryItem key={h.history_id}>
              <div>
                {h.user_nickname} 移动到 {h.box_name}
              </div>
              <div style={{ color: '#999', fontSize: 12 }}>
                {formatTime(h.history_time)}
              </div>
            </HistoryItem>
          ))}
        </div>
      </Popup>

      {/* 评论完整列表弹窗 */}
      <Popup
        visible={showAllComments}
        onMaskClick={() => setShowAllComments(false)}
        bodyStyle={{ height: '60vh', borderRadius: '12px 12px 0 0', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
          <SectionTitle style={{ marginBottom: 16 }}>评论 (全部 {comments.length} 条)</SectionTitle>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
          {comments.map((c) => (
            <CommentItem key={c.comment_id}>
              <CommentUser>{c.user_nickname}</CommentUser>
              <CommentContent>{c.comment_content}</CommentContent>
              <CommentTime>{formatTime(c.comment_create_time)}</CommentTime>
            </CommentItem>
          ))}
        </div>
      </Popup>

      {/* 备注名编辑弹窗 */}
      <Popup
        visible={editingRemark}
        onMaskClick={() => setEditingRemark(false)}
        bodyStyle={{ borderRadius: '12px 12px 0 0' }}
      >
        <PopupContent>
          <SectionTitle style={{ marginBottom: 16 }}>编辑备注名</SectionTitle>
          <div style={{ marginBottom: 16, fontSize: 13, color: '#666' }}>
            原名称：{item?.item_name}
          </div>
          <Input
            value={editRemarkText}
            onChange={setEditRemarkText}
            placeholder="输入备注名（留空则显示原名称）"
            style={{ marginBottom: 16 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button color="primary" size="small" onClick={handleSaveRemark}>
              保存
            </Button>
            <Button size="small" onClick={() => setEditingRemark(false)}>
              取消
            </Button>
          </div>
        </PopupContent>
      </Popup>
    </>
  );
}
