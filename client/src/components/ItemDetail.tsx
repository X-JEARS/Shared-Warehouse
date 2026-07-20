import { useEffect, useState } from 'react';
import { Popup, Button, Input, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
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
  border-radius: var(--app-radius-m);
  background: ${(props) =>
    props.$image ? `url(${props.$image}) center/cover` : 'var(--app-color-img-placeholder)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  ${(props) => props.$image && 'cursor: pointer;'}
`;

const ImageViewerOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--app-color-overlay-heavy);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const ImageViewerImg = styled.img`
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
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
  color: var(--app-color-text-weak);
  margin-bottom: 4px;
`;

const StockBadge = styled.span<{ $inStock: boolean }>`
  display: inline-block;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: var(--app-radius-s);
  margin-left: 8px;
  background: ${(props) => (props.$inStock ? 'var(--app-color-badge-instock-bg)' : 'var(--app-color-badge-outstock-bg)')};
  color: ${(props) => (props.$inStock ? 'var(--app-color-badge-instock-text)' : 'var(--app-color-badge-outstock-text)')};
`;

const Section = styled.div`
  margin-bottom: 20px;
`;

const SectionTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: var(--app-color-text);
  margin-bottom: 12px;
`;

const HistoryItem = styled.div`
  padding: 10px 0;
  border-bottom: 1px solid var(--app-color-border);
  font-size: 13px;
`;

const CommentItem = styled.div`
  padding: 12px 0;
  border-bottom: 1px solid var(--app-color-border);
`;

const CommentUser = styled.div`
  font-weight: 500;
  margin-bottom: 4px;
`;

const CommentContent = styled.div`
  font-size: 14px;
  color: var(--app-color-text);
`;

const CommentTime = styled.div`
  font-size: 12px;
  color: var(--app-color-text-secondary);
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
  const { t, i18n } = useTranslation();
  const [item, setItem] = useState<any>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
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
  const [editingNotice, setEditingNotice] = useState(false);
  const [editNoticeText, setEditNoticeText] = useState('');
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
      Toast.show({ content: t('itemDetail.nameEmpty') });
      return;
    }
    try {
      await itemApi.update(itemId!, { name: editName });
      setItem({ ...item, item_name: editName });
      setEditing(false);
      Toast.show({ icon: 'success', content: t('itemDetail.updateSuccess') });
      onUpdate?.();
    } catch (error) {
      Toast.show({ icon: 'fail', content: t('itemDetail.updateFailed') });
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      Toast.show({ content: t('itemDetail.commentEmpty') });
      return;
    }
    try {
      await itemApi.addComment(itemId!, commentText);
      setCommentText('');
      loadComments();
      Toast.show({ icon: 'success', content: t('itemDetail.commentSuccess') });
    } catch (error) {
      Toast.show({ icon: 'fail', content: t('itemDetail.commentFailed') });
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
      Toast.show({ icon: 'success', content: t('itemDetail.tagsUpdated') });
      onUpdate?.();
    } catch (error) {
      Toast.show({ icon: 'fail', content: t('itemDetail.updateFailed') });
    }
  };

  const handleAddToCart = () => {
    if (!item) return;
    addItem({
      itemId: item.item_id,
      roomId: roomId ?? 0,
      itemName: item.remark || item.item_name,
      itemQrcode: item.item_qrcode,
      itemImage: item.item_image,
      boxName: item.box_name,
      roomName: item.room_name,
    });
    Toast.show({ icon: 'success', content: t('itemDetail.addedToCart') });
  };

  const handleSaveRemark = async () => {
    if (!item?.room_id) return;
    try {
      await itemApi.setRemark(itemId!, item.room_id, editRemarkText);
      setItem({ ...item, remark: editRemarkText || null });
      setEditingRemark(false);
      Toast.show({ icon: 'success', content: t('itemDetail.remarkUpdated') });
      onUpdate?.();
    } catch (error) {
      Toast.show({ icon: 'fail', content: t('itemDetail.updateFailed') });
    }
  };

  const handleSaveNotice = async () => {
    try {
      await itemApi.update(itemId!, { notice: editNoticeText });
      setItem({ ...item, item_notice: editNoticeText || null });
      setEditingNotice(false);
      Toast.show({ icon: 'success', content: t('itemDetail.noticeUpdated') });
      onUpdate?.();
    } catch (error) {
      Toast.show({ icon: 'fail', content: t('itemDetail.updateFailed') });
    }
  };

  const formatTime = (timestamp: number | string) => {
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    if (!ts || isNaN(ts)) return t('common.unknownTime');
    return new Date(ts).toLocaleString(i18n.language === 'en-US' ? 'en-US' : 'zh-CN');
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
                {isInCart ? t('itemDetail.reserved') : t('itemDetail.reserve')}
              </Button>
            </div>
            <ItemHeader>
              <ItemImage $image={item.item_image} onClick={() => item.item_image && setShowImageViewer(true)}>
                {!item.item_image && '📦'}
              </ItemImage>
              <ItemTitle>
                {editing ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input
                      value={editName}
                      onChange={setEditName}
                      placeholder={t('itemDetail.itemNamePlaceholder')}
                      style={{ flex: 1 }}
                    />
                    <Button size="small" onClick={handleUpdateName}>
                      {t('common.save')}
                    </Button>
                    <Button size="small" onClick={() => setEditing(false)}>
                      {t('common.cancel')}
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
                          color: 'var(--app-color-primary)',
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
                        {t('itemDetail.editName')}
                      </Button>
                    )}
                  </ItemName>
                )}
                <ItemMeta>{t('itemDetail.createdAt', { time: formatTime(item.item_create_time) })}</ItemMeta>
                <ItemMeta>
                  {t('itemDetail.currentLocation', { location: item.display_location_name || item.current_room_name || t('itemDetail.unknownWarehouse') })}
                  {item.current_box_name && ` / ${item.current_box_name}`}
                  {item.is_in_stock !== undefined && (
                    <StockBadge $inStock={item.is_in_stock || item.is_foreign}>
                      {item.is_foreign ? t('status.foreign') : (item.is_in_stock ? t('status.inStock') : t('status.outOfStock'))}
                    </StockBadge>
                  )}
                </ItemMeta>
                {item.is_foreign && (
                  <ItemMeta>
                    {t('itemDetail.shouldReturnTo', { location: `${item.belong_room_name || item.room_name}${item.belong_box_name ? ` / ${item.belong_box_name}` : ''}` })}
                  </ItemMeta>
                )}
                {!item.is_in_stock && !item.is_foreign && (
                  <ItemMeta>
                    {t('itemDetail.shouldReturnTo', { location: `${item.belong_room_name || item.room_name}${item.belong_box_name ? ` / ${item.belong_box_name}` : ''}${item.holder_nickname ? ` (${t('itemDetail.withPerson', { name: item.holder_nickname })})` : ''}` })}
                  </ItemMeta>
                )}
                {item.owner_nickname && (
                  <ItemMeta>{t('itemDetail.owner', { name: item.owner_nickname })}</ItemMeta>
                )}
              </ItemTitle>
            </ItemHeader>

            <Section>
                <SectionTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {t('itemDetail.remark')}
                  <Button size="mini" onClick={() => { setEditNoticeText(item.item_notice || ''); setEditingNotice(true); }}>
                    {t('common.edit')}
                  </Button>
                </SectionTitle>
                <div style={{ fontSize: 14, color: 'var(--app-color-text-weak)' }}>{item.item_notice || t('itemDetail.noRemark')}</div>
              </Section>

            <Section>
              <SectionTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {t('itemDetail.tags')}
                {item.room_id && !editingTags && (
                  <Button size="mini" onClick={() => setEditingTags(true)}>
                    {t('common.edit')}
                  </Button>
                )}
              </SectionTitle>
              {editingTags ? (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {allTags.length === 0 ? (
                      <span style={{ color: 'var(--app-color-text-secondary)', fontSize: 13 }}>{t('itemDetail.noTagsAvailable')}</span>
                    ) : (
                      allTags.map((tag: any) => (
                        <span
                          key={tag.tag_id}
                          onClick={() => toggleTag(tag.tag_id)}
                          style={{
                            padding: '4px 12px',
                            background: selectedTagIds.includes(tag.tag_id) ? 'var(--app-color-primary)' : 'var(--app-color-bg)',
                            color: selectedTagIds.includes(tag.tag_id) ? 'var(--app-color-white)' : 'var(--app-color-text-weak)',
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
                      {t('common.save')}
                    </Button>
                    <Button size="small" onClick={() => {
                      setEditingTags(false);
                      // 恢复原始选中状态
                      if (item.tags) {
                        setSelectedTagIds(item.tags.map((t: any) => t.tag_id));
                      }
                    }}>
                      {t('common.cancel')}
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
                          background: 'var(--app-color-badge-foreign-bg)',
                          color: 'var(--app-color-badge-foreign-text)',
                          borderRadius: 4,
                          fontSize: 13,
                        }}
                      >
                        {tag.tag_name}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: 'var(--app-color-text-secondary)', fontSize: 13 }}>{t('itemDetail.noTags')}</span>
                  )}
                </div>
              )}
            </Section>

            {reservations.length > 0 && (
              <Section>
                <SectionTitle>{t('itemDetail.reservationRecords')}</SectionTitle>
                {reservations.map((r) => (
                  <HistoryItem key={r.reservation_id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500 }}>{r.user_nickname}</span>
                      <span style={{
                        fontSize: 12,
                        padding: '2px 8px',
                        background: r.reservation_start_time > Date.now() ? 'var(--app-color-warning-bg)' : 'var(--app-color-success-bg)',
                        color: r.reservation_start_time > Date.now() ? 'var(--app-color-warning-text)' : 'var(--app-color-success)',
                        borderRadius: 4
                      }}>
                        {r.reservation_start_time > Date.now() ? t('status.pending') : t('status.inUse')}
                      </span>
                    </div>
                    <div style={{ color: 'var(--app-color-text-weak)', fontSize: 12, marginTop: 4 }}>
                      {formatTime(r.reservation_start_time)} ~ {formatTime(r.reservation_end_time)}
                    </div>
                  </HistoryItem>
                ))}
              </Section>
            )}

            {history.length > 0 && (
              <Section>
                <SectionTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {t('itemDetail.transferRecords')}
                  {history.length > 3 && (
                    <Button size="mini" onClick={() => setShowAllHistory(true)}>{t('common.more')}</Button>
                  )}
                </SectionTitle>
                {history.slice(0, 3).map((h) => (
                  <HistoryItem key={h.history_id}>
                    <div>
                      {h.is_user_box ? t('itemDetail.tookItem', { name: h.user_nickname }) : t('itemDetail.putItemInBox', { name: h.user_nickname, boxName: h.box_name })}
                    </div>
                    <div style={{ color: 'var(--app-color-text-secondary)', fontSize: 12 }}>
                      {formatTime(h.history_time)}
                    </div>
                  </HistoryItem>
                ))}
              </Section>
            )}

            <Section>
              <SectionTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {t('itemDetail.comments')} ({comments.length})
                {comments.length > 5 && (
                  <Button size="mini" onClick={() => setShowAllComments(true)}>{t('common.more')}</Button>
                )}
              </SectionTitle>
              <CommentInput>
                <Input
                  value={commentText}
                  onChange={setCommentText}
                  placeholder={t('itemDetail.addCommentPlaceholder')}
                  style={{ flex: 1 }}
                />
                <Button color="primary" size="small" onClick={handleAddComment}>
                  {t('itemDetail.send')}
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

    {showImageViewer && item?.item_image && (
      <ImageViewerOverlay onClick={() => setShowImageViewer(false)}>
        <ImageViewerImg src={item.item_image} alt={item.item_name} />
      </ImageViewerOverlay>
    )}
      <Popup
        visible={showAllHistory}
        onMaskClick={() => setShowAllHistory(false)}
        bodyStyle={{ height: '60vh', borderRadius: '12px 12px 0 0', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
          <SectionTitle style={{ marginBottom: 16 }}>{t('itemDetail.allTransferRecords', { count: history.length })}</SectionTitle>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
          {history.map((h) => (
            <HistoryItem key={h.history_id}>
              <div>
                {h.is_user_box ? t('itemDetail.tookItem', { name: h.user_nickname }) : t('itemDetail.putItemInBox', { name: h.user_nickname, boxName: h.box_name })}
              </div>
              <div style={{ color: 'var(--app-color-text-secondary)', fontSize: 12 }}>
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
          <SectionTitle style={{ marginBottom: 16 }}>{t('itemDetail.allComments', { count: comments.length })}</SectionTitle>
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

      {/* 别名编辑弹窗 */}
      <Popup
        visible={editingRemark}
        onMaskClick={() => setEditingRemark(false)}
        bodyStyle={{ borderRadius: '12px 12px 0 0' }}
      >
        <PopupContent>
          <SectionTitle style={{ marginBottom: 16 }}>{t('itemDetail.editRemark')}</SectionTitle>
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--app-color-text-weak)' }}>
            {t('itemDetail.originalName', { name: item?.item_name })}
          </div>
          <Input
            value={editRemarkText}
            onChange={setEditRemarkText}
            placeholder={t('itemDetail.remarkPlaceholder')}
            style={{ marginBottom: 16 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button color="primary" size="small" onClick={handleSaveRemark}>
              {t('common.save')}
            </Button>
            <Button size="small" onClick={() => setEditingRemark(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </PopupContent>
      </Popup>

      {/* 备注编辑弹窗 */}
      <Popup
        visible={editingNotice}
        onMaskClick={() => setEditingNotice(false)}
        bodyStyle={{ borderRadius: '12px 12px 0 0' }}
      >
        <PopupContent>
          <SectionTitle style={{ marginBottom: 16 }}>{t('itemDetail.editNotice')}</SectionTitle>
          <Input
            value={editNoticeText}
            onChange={setEditNoticeText}
            placeholder={t('itemDetail.noticePlaceholder')}
            style={{ marginBottom: 16 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button color="primary" size="small" onClick={handleSaveNotice}>
              {t('common.save')}
            </Button>
            <Button size="small" onClick={() => setEditingNotice(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </PopupContent>
      </Popup>
    </>
  );
}
