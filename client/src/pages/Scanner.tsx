import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Toast, SpinLoading, Dialog } from 'antd-mobile';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import ScannerComponent, { ScannerHandle } from '../components/Scanner';
import ScanResultList, { PendingItem } from '../components/ScanResultList';
import { scanApi } from '../services/api';

type ScanMode = 'idle' | 'borrow' | 'return';

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

const ButtonRow = styled.div`
  display: flex;
  gap: 12px;
  flex-shrink: 0;
`;

const ResultListWrapper = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-top: 12px;
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scannerRef = useRef<ScannerHandle>(null);
  const [mode, setMode] = useState<ScanMode>('idle');
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [returnTargetBox, setReturnTargetBox] = useState<any>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  // 用 ref 持有最新 pendingItems，避免闭包陈旧导致去重失效
  const pendingItemsRef = useRef<PendingItem[]>([]);
  pendingItemsRef.current = pendingItems;

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
        return false; // 继续扫描
      }

      // 进入取走模式
      setMode('borrow');
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
      const res: any = await scanApi.borrowBatch(itemIds);
      const { totalSucceeded, totalFailed } = res.data;

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
      const res: any = await scanApi.returnBatch(items);
      const { totalSucceeded, totalFailed } = res.data;

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
    // 操作完成后不再重启扫码器，摄像头已释放
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
            <ButtonRow>
              <Button
                block
                fill="outline"
                onClick={resetMode}
                style={{ flex: 1 }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                block
                color="primary"
                disabled={actionCount === 0}
                loading={actionLoading}
                onClick={mode === 'borrow' ? handleBatchBorrow : handleBatchReturn}
                style={{ flex: 1 }}
              >
                {actionLabel} ({actionCount})
              </Button>
            </ButtonRow>

            <ResultListWrapper>
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
