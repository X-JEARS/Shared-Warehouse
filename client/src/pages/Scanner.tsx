import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Toast, SpinLoading, Dialog, Dropdown, DropdownRef } from 'antd-mobile';
import { CloseOutline, PictureOutline } from 'antd-mobile-icons';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import ScannerComponent, { ScannerHandle } from '../components/Scanner';
import ScanResultList, { PendingItem } from '../components/ScanResultList';
import { reservationApi, scanApi } from '../services/api';
import { useRoomStore } from '../stores/roomStore';

type ScanMode = 'idle' | 'borrow' | 'return';

interface ReferenceReservation {
  reservation_id: number;
  reservation_item_id: number;
  item_name: string;
  item_qrcode: string;
  current_box_id: number | null;
  current_box_name: string | null;
  current_room_id: number | null;
  current_room_name: string | null;
  holder_user_id: number | null;
  holder_nickname: string | null;
  is_in_user_hand: boolean;
}

interface ReferenceOrder {
  order_id: number;
  order_create_time: number | string;
  order_title: string | null;
  reservations: ReferenceReservation[];
}

type ReferenceStatus = 'borrow-scanned' | 'return-scanned' | 'in-hand' | 'attention' | 'none';

const Container = styled.div`
  height: 100dvh;
  background: var(--app-color-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  background: var(--app-color-surface);
  padding: 8px 16px;
  border-bottom: 1px solid var(--app-color-border);
  display: flex;
  align-items: center;
  flex-shrink: 0;
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
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ScanHint = styled.div`
  background: var(--app-color-info-bg);
  border: 1px solid var(--app-color-info-border);
  border-radius: var(--app-radius-m);
  padding: 12px;
  margin-top: 16px;
  text-align: center;
  color: var(--app-color-info-text);
  font-size: 14px;
  flex-shrink: 0;
`;

const BoxLink = styled.span`
  color: var(--app-color-primary);
  cursor: pointer;
  font-weight: 500;

  &:active {
    opacity: 0.7;
  }
`;

const BatchActionArea = styled.div`
  margin-top: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ActionRow = styled.div`
  min-height: 44px;
  display: grid;
  grid-template-columns: minmax(110px, 36%) minmax(0, 1fr);
  gap: 8px;
  flex-shrink: 0;
`;

const ButtonRow = styled.div`
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  .adm-button {
    min-width: 0;
    height: 100%;
    padding-left: 6px;
    padding-right: 6px;
    font-size: 13px;
  }

  .adm-button-content {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const PhotoArea = styled.div`
  min-width: 0;

  .adm-button {
    min-width: 0;
    height: 100%;
    padding-left: 6px;
    padding-right: 6px;
    font-size: 13px;
  }

  .adm-button-content {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const PhotoSelection = styled.div`
  min-width: 0;
  height: 44px;
  box-sizing: border-box;
  padding: 4px;
  border: 1px solid var(--app-color-border);
  border-radius: var(--app-radius-m);
  background: var(--app-color-surface);
  display: flex;
  align-items: center;
  gap: 4px;
`;

const PhotoPreview = styled.img`
  width: 34px;
  height: 34px;
  border-radius: var(--app-radius-s);
  object-fit: cover;
  flex-shrink: 0;
`;

const PhotoName = styled.div`
  flex: 1;
  min-width: 0;
  color: var(--app-color-text);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PhotoAction = styled.button`
  width: 24px;
  height: 34px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
`;

const HiddenPhotoInput = styled.input`
  display: none;
`;

const ReferenceDropdownHost = styled.div<{ $open: boolean }>`
  width: 100%;
  flex-shrink: 0;

  .adm-dropdown-item-title-arrow {
    transition: none !important;
  }

  .adm-dropdown-popup-body {
    display: ${({ $open }) => $open ? 'block' : 'none'} !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
  }

  .adm-dropdown-popup-mask {
    display: ${({ $open }) => $open ? 'block' : 'none'} !important;
    opacity: ${({ $open }) => $open ? 1 : 0} !important;
    transition: none !important;
    animation: none !important;
  }
`;

const ReferenceDropdown = styled(Dropdown)`
  width: 100%;
  margin-bottom: 12px;
  border: 1px solid var(--app-color-border);
  border-radius: var(--app-radius-m);
  background: var(--app-color-surface);
  flex-shrink: 0;
  overflow: hidden;

  .adm-dropdown-nav {
    min-height: 40px;
  }

  .adm-dropdown-item {
    justify-content: flex-start;
  }

  .adm-dropdown-item-title {
    width: 100%;
    justify-content: space-between;
    padding: 10px 12px;
    color: var(--app-color-text);
  }
`;

const ReferenceDropdownContent = styled.div`
  max-height: 300px;
  overflow-y: auto;
  padding: 4px 16px;
`;

const ReferenceOption = styled.button<{ $active?: boolean }>`
  width: 100%;
  min-height: 44px;
  padding: 10px 0;
  border: none;
  border-bottom: 1px solid var(--app-color-border);
  background: transparent;
  color: ${({ $active }) => $active ? 'var(--app-color-primary)' : 'var(--app-color-text)'};
  font-size: 14px;
  text-align: left;
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:active {
    opacity: 0.7;
  }
`;

const ReferenceMenuMessage = styled.div`
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--app-color-text-secondary);
  font-size: 14px;
`;

const ResultListWrapper = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-top: 12px;
`;

const ListSectionTitle = styled.div`
  color: var(--app-color-text-weak);
  font-size: 13px;
  font-weight: 500;
  margin: 4px 0 8px;
`;

const ReferenceList = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
`;

const ReferenceItem = styled.div`
  min-width: 0;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
`;

const StatusSlot = styled.div`
  width: 10px;
  height: 10px;
  flex-shrink: 0;
`;

const StatusDot = styled.div<{ $status: Exclude<ReferenceStatus, 'none'> }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $status }) => {
    if ($status === 'in-hand') return 'var(--app-color-success)';
    if ($status === 'borrow-scanned') return 'var(--app-color-primary)';
    if ($status === 'return-scanned') return 'var(--app-color-warning)';
    return 'var(--app-color-danger)';
  }};
`;

const ReferenceItemInfo = styled.div`
  min-width: 0;
  flex: 1;
  padding: 7px 0;
`;

const ReferenceItemName = styled.div`
  color: var(--app-color-text);
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ReferenceItemLocation = styled.div`
  color: var(--app-color-text-secondary);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LoadingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--app-color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

export default function Scanner() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const currentRoom = useRoomStore(state => state.currentRoom);
  const scannerRef = useRef<ScannerHandle>(null);
  const referenceDropdownRef = useRef<DropdownRef>(null);
  const referenceDropdownHostRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ScanMode>('idle');
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [returnTargetBox, setReturnTargetBox] = useState<any>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [referenceRoomId, setReferenceRoomId] = useState<number | null>(null);
  const [referenceOrders, setReferenceOrders] = useState<ReferenceOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceDropdownOpen, setReferenceDropdownOpen] = useState(false);
  const [transferImage, setTransferImage] = useState<File | null>(null);
  const [transferImagePreview, setTransferImagePreview] = useState<string | null>(null);
  // 用 ref 持有最新 pendingItems，避免闭包陈旧导致去重失效
  const pendingItemsRef = useRef<PendingItem[]>([]);
  pendingItemsRef.current = pendingItems;

  useEffect(() => {
    return () => {
      if (transferImagePreview) URL.revokeObjectURL(transferImagePreview);
    };
  }, [transferImagePreview]);

  useEffect(() => {
    if (mode === 'idle' || !referenceRoomId) {
      setReferenceOrders([]);
      setSelectedOrderId(null);
      return;
    }

    let canceled = false;
    setReferenceLoading(true);
    setSelectedOrderId(null);

    reservationApi.getRecentRoomOrders(referenceRoomId)
      .then((res: any) => {
        if (!canceled) setReferenceOrders(res.data || []);
      })
      .catch((error: any) => {
        if (canceled) return;
        console.error('Failed to load recent reservation orders:', error);
        setReferenceOrders([]);
        Toast.show({ icon: 'fail', content: t('scanner.referenceOrdersLoadFailed') });
      })
      .finally(() => {
        if (!canceled) setReferenceLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [mode, referenceRoomId, t]);

  const addItemToList = (item: any, qrcode: string) => {
    const exists = pendingItemsRef.current.some(p => p.qrcode === qrcode);
    if (exists) {
      Toast.show({ content: t('scanner.itemInList') });
      return;
    }
    setPendingItems(prev => [...prev, {
      itemId: item.item_id,
      itemName: item.item_name,
      itemImage: item.item_image,
      locationName: item.display_location_name || item.room_name || t('common.unknown'),
      isInHand: item.isInHand || false,
      qrcode,
    }]);
    Toast.show({ content: t('scanner.itemAdded', { name: item.item_name }) });
  };

  const handleScan = async (qrcode: string): Promise<boolean> => {
    // 模式已确定时的处理
    if (mode === 'borrow') {
      if (qrcode.toLowerCase().startsWith('box.')) {
        Toast.show({ content: t('scanner.borrowModeHint') });
        return false;
      }
      try {
        setScanLoading(true);
        const res: any = await scanApi.scan(qrcode);
        if (res.data.type !== 'item') {
          Toast.show({ icon: 'fail', content: t('scanner.notItem') });
          return false;
        }
        addItemToList(res.data.item, qrcode);
        return false;
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || t('scanner.scanFailed') });
        return false;
      } finally {
        setScanLoading(false);
      }
    }

    if (mode === 'return') {
      if (qrcode.toLowerCase().startsWith('box.')) {
        Toast.show({ content: t('scanner.returnModeHint') });
        return false;
      }
      try {
        setScanLoading(true);
        const res: any = await scanApi.scan(qrcode);
        if (res.data.type !== 'item') {
          Toast.show({ icon: 'fail', content: t('scanner.notItem') });
          return false;
        }
        addItemToList(res.data.item, qrcode);
        return false;
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || t('scanner.scanFailed') });
        return false;
      } finally {
        setScanLoading(false);
      }
    }

    // idle 模式：首次扫描决定模式
    try {
      setScanLoading(true);
      const res: any = await scanApi.scan(qrcode);

      if (res.data.type === 'box') {
        // 进入放入模式
        setMode('return');
        setReturnTargetBox(res.data.box);
        setReferenceRoomId(currentRoom?.room_id || null);
        return false; // 继续扫描
      }

      // 进入取走模式
      setMode('borrow');
      setReferenceRoomId(currentRoom?.room_id || null);
      addItemToList(res.data.item, qrcode);
      return false; // 继续扫描
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('scanner.idleScanFailed') });
      return false;
    } finally {
      setScanLoading(false);
    }
  };

  const handleRemoveItem = (qrcode: string) => {
    setPendingItems(prev => prev.filter(p => p.qrcode !== qrcode));
  };

  const clearTransferImage = () => {
    setTransferImage(null);
    setTransferImagePreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      Toast.show({ icon: 'fail', content: t('scanner.invalidTransferImage') });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      Toast.show({ icon: 'fail', content: t('scanner.transferImageTooLarge') });
      return;
    }

    setTransferImage(file);
    setTransferImagePreview(URL.createObjectURL(file));
  };

  const handleBatchBorrow = async () => {
    const borrowableItems = pendingItems.filter(p => !p.isInHand);
    if (borrowableItems.length === 0) {
      Toast.show({ content: t('scanner.noBorrowableItems') });
      return;
    }

    scannerRef.current?.pause();
    const result = await Dialog.confirm({
      title: t('scanner.confirmBorrow'),
      content: t('scanner.confirmBorrowContent', { count: borrowableItems.length }),
    });
    if (!result) {
      scannerRef.current?.resume();
      return;
    }

    setActionLoading(true);
    try {
      const itemIds = borrowableItems.map(p => p.itemId);
      const res: any = await scanApi.borrowBatch(itemIds, transferImage || undefined);
      const { totalSucceeded, totalFailed } = res.data;
      if (res.data.transferRecordId) clearTransferImage();

      if (totalFailed > 0) {
        Toast.show({ icon: 'fail', content: t('scanner.borrowPartialSuccess', { succeeded: totalSucceeded, failed: totalFailed }) });
        const failedIds = res.data.results
          .filter((r: any) => !r.success)
          .map((r: any) => r.itemId);
        setPendingItems(prev => prev.filter(p => failedIds.includes(p.itemId)));
        scannerRef.current?.resume();
      } else {
        Toast.show({ icon: 'success', content: t('scanner.borrowSuccess', { count: totalSucceeded }) });
        resetMode();
      }
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('scanner.borrowFailed') });
      scannerRef.current?.resume();
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchReturn = async () => {
    if (!returnTargetBox || pendingItems.length === 0) return;

    scannerRef.current?.pause();
    const result = await Dialog.confirm({
      title: t('scanner.confirmReturn'),
      content: t('scanner.confirmReturnContent', { count: pendingItems.length, boxName: returnTargetBox.box_name }),
    });
    if (!result) {
      scannerRef.current?.resume();
      return;
    }

    setActionLoading(true);
    try {
      const items = pendingItems.map(p => ({ itemId: p.itemId, boxId: returnTargetBox.box_id }));
      const res: any = await scanApi.returnBatch(items, transferImage || undefined);
      const { totalSucceeded, totalFailed } = res.data;
      if (res.data.transferRecordId) clearTransferImage();

      if (totalFailed > 0) {
        Toast.show({ icon: 'fail', content: t('scanner.returnPartialSuccess', { succeeded: totalSucceeded, failed: totalFailed }) });
        const failedIds = res.data.results
          .filter((r: any) => !r.success)
          .map((r: any) => r.itemId);
        setPendingItems(prev => prev.filter(p => failedIds.includes(p.itemId)));
        scannerRef.current?.resume();
      } else {
        Toast.show({ icon: 'success', content: t('scanner.returnSuccess', { count: totalSucceeded }) });
        resetMode();
      }
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('scanner.returnFailed') });
      scannerRef.current?.resume();
    } finally {
      setActionLoading(false);
    }
  };

  const resetMode = () => {
    setMode('idle');
    setPendingItems([]);
    setReturnTargetBox(null);
    setReferenceRoomId(null);
    setReferenceOrders([]);
    setSelectedOrderId(null);
    setReferenceDropdownOpen(false);
    clearTransferImage();
    // 操作完成后不再重启扫码器，摄像头已释放
  };

  const selectedOrder = referenceOrders.find(order => order.order_id === selectedOrderId) || null;

  const formatOrderLabel = (order: ReferenceOrder) => {
    const timestamp = typeof order.order_create_time === 'string'
      ? parseInt(order.order_create_time, 10)
      : order.order_create_time;
    const date = new Date(timestamp).toLocaleDateString(
      i18n.language === 'en-US' ? 'en-US' : 'zh-CN',
      { month: 'numeric', day: 'numeric' }
    );
    const title = order.order_title || t('scanner.orderFallbackTitle', { id: order.order_id });
    return `${title} · ${date}`;
  };

  const scannedIds = useMemo(() => new Set(pendingItems.map(p => p.itemId)), [pendingItems]);

  const getReferenceStatus = (reservation: ReferenceReservation): ReferenceStatus => {
    const isScanned = scannedIds.has(reservation.reservation_item_id);

    if (mode === 'borrow') {
      if (reservation.is_in_user_hand) return 'in-hand';
      return isScanned ? 'borrow-scanned' : 'none';
    }

    if (isScanned) return 'return-scanned';
    if (reservation.is_in_user_hand) return 'in-hand';
    if (reservation.current_room_id === referenceRoomId) return 'none';
    return 'attention';
  };

  const getStatusLabel = (status: ReferenceStatus) => {
    if (status === 'borrow-scanned') return t('scanner.statusReadyToBorrow');
    if (status === 'return-scanned') return t('scanner.statusReadyToReturn');
    if (status === 'in-hand') return t('scanner.statusInHand');
    if (status === 'attention') return t('scanner.statusAttention');
    return undefined;
  };

  const getReferenceLocation = (reservation: ReferenceReservation) => {
    if (reservation.holder_nickname) return reservation.holder_nickname;
    if (reservation.current_room_name && reservation.current_box_name) {
      return `${reservation.current_room_name} / ${reservation.current_box_name}`;
    }
    return reservation.current_room_name || reservation.current_box_name || t('common.unknown');
  };

  const selectReferenceOrder = (orderId: number | null) => {
    setSelectedOrderId(orderId);
    setReferenceDropdownOpen(false);
    referenceDropdownRef.current?.close();
  };

  const navTitle = mode === 'borrow' ? t('scanner.scanBorrow') : mode === 'return' ? t('scanner.scanReturn') : t('scanner.scanQRCode');

  const actionLabel = mode === 'borrow' ? t('scanner.borrow') : t('scanner.putIn');
  const actionCount = mode === 'borrow'
    ? pendingItems.filter(p => !p.isInHand).length
    : pendingItems.length;

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>{navTitle}</HeaderTitle>
      </Header>

      <Content>
        <ScannerComponent
          ref={scannerRef}
          onScan={handleScan}
          onError={(error) => {
            console.error('Scanner error:', error);
          }}
        />

        {mode !== 'idle' && (
          <ScanHint>
            {mode === 'borrow' && t('scanner.scanItemHint')}
            {mode === 'return' && (
              <>
                {t('scanner.putInto')}{' '}
                <BoxLink onClick={() => navigate(`/box/${returnTargetBox.box_id}`)}>
                  {returnTargetBox.box_name}
                </BoxLink>
              </>
            )}
          </ScanHint>
        )}

        {mode !== 'idle' && (
          <BatchActionArea>
            <ReferenceDropdownHost ref={referenceDropdownHostRef} $open={referenceDropdownOpen}>
              <ReferenceDropdown
                ref={referenceDropdownRef}
                activeKey={referenceDropdownOpen ? 'reference-order' : null}
                getContainer={() => referenceDropdownHostRef.current || document.body}
                onChange={(key) => setReferenceDropdownOpen(key === 'reference-order')}
              >
                <Dropdown.Item
                  key="reference-order"
                  highlight={selectedOrderId !== null}
                  title={
                    referenceLoading
                      ? t('scanner.loadingReferenceOrders')
                      : selectedOrder
                        ? formatOrderLabel(selectedOrder)
                        : mode === 'borrow'
                          ? t('scanner.freeBorrow')
                          : t('scanner.freeReturn')
                  }
                >
                  <ReferenceDropdownContent>
                    {referenceLoading ? (
                      <ReferenceMenuMessage>
                        <SpinLoading style={{ '--size': '16px' }} />
                        {t('scanner.loadingReferenceOrders')}
                      </ReferenceMenuMessage>
                    ) : (
                      <>
                        <ReferenceOption
                          type="button"
                          $active={selectedOrderId === null}
                          onClick={() => selectReferenceOrder(null)}
                        >
                          {mode === 'borrow' ? t('scanner.freeBorrow') : t('scanner.freeReturn')}
                        </ReferenceOption>
                        {referenceOrders.map(order => (
                          <ReferenceOption
                            key={order.order_id}
                            type="button"
                            $active={selectedOrderId === order.order_id}
                            onClick={() => selectReferenceOrder(order.order_id)}
                          >
                            {formatOrderLabel(order)}
                          </ReferenceOption>
                        ))}
                        {referenceOrders.length === 0 && (
                          <ReferenceMenuMessage>{t('scanner.noReferenceOrders')}</ReferenceMenuMessage>
                        )}
                      </>
                    )}
                  </ReferenceDropdownContent>
                </Dropdown.Item>
              </ReferenceDropdown>
            </ReferenceDropdownHost>

            <ActionRow>
              <PhotoArea>
                {transferImage && transferImagePreview ? (
                  <PhotoSelection>
                    <PhotoPreview src={transferImagePreview} alt={t('scanner.transferPhoto')} />
                    <PhotoName title={transferImage.name}>{transferImage.name}</PhotoName>
                    <PhotoAction
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      title={t('scanner.replaceTransferPhoto')}
                      aria-label={t('scanner.replaceTransferPhoto')}
                      disabled={actionLoading}
                    >
                      <PictureOutline fontSize={18} />
                    </PhotoAction>
                    <PhotoAction
                      type="button"
                      onClick={clearTransferImage}
                      title={t('scanner.removeTransferPhoto')}
                      aria-label={t('scanner.removeTransferPhoto')}
                      disabled={actionLoading}
                    >
                      <CloseOutline fontSize={18} />
                    </PhotoAction>
                  </PhotoSelection>
                ) : (
                  <Button
                    block
                    fill="outline"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={actionLoading}
                  >
                    <PictureOutline fontSize={18} />
                    <span style={{ marginLeft: 4 }}>{t('scanner.uploadTransferPhoto')}</span>
                  </Button>
                )}
                <HiddenPhotoInput
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handlePhotoChange}
                />
              </PhotoArea>

              <ButtonRow>
                <Button
                  block
                  fill="outline"
                  onClick={resetMode}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  block
                  color="primary"
                  disabled={actionCount === 0}
                  loading={actionLoading}
                  onClick={mode === 'borrow' ? handleBatchBorrow : handleBatchReturn}
                >
                  {actionLabel} ({actionCount})
                </Button>
              </ButtonRow>
            </ActionRow>

            <ResultListWrapper>
              {selectedOrder && (
                <>
                  <ListSectionTitle>{t('scanner.reservationChecklist')}</ListSectionTitle>
                  <ReferenceList>
                    {selectedOrder.reservations.map(reservation => {
                      const status = getReferenceStatus(reservation);
                      const statusLabel = getStatusLabel(status);
                      return (
                        <ReferenceItem key={reservation.reservation_id}>
                          <StatusSlot>
                            {status !== 'none' && (
                              <StatusDot
                                $status={status}
                                aria-label={statusLabel}
                                title={statusLabel}
                              />
                            )}
                          </StatusSlot>
                          <ReferenceItemInfo>
                            <ReferenceItemName>{reservation.item_name}</ReferenceItemName>
                            <ReferenceItemLocation>{getReferenceLocation(reservation)}</ReferenceItemLocation>
                          </ReferenceItemInfo>
                        </ReferenceItem>
                      );
                    })}
                  </ReferenceList>
                  <ListSectionTitle>{t('scanner.scannedItems')}</ListSectionTitle>
                </>
              )}
              <ScanResultList
                items={pendingItems}
                onRemoveItem={handleRemoveItem}
              />
            </ResultListWrapper>
          </BatchActionArea>
        )}
      </Content>

      {scanLoading && (
        <LoadingOverlay>
          <SpinLoading />
        </LoadingOverlay>
      )}
    </Container>
  );
}
