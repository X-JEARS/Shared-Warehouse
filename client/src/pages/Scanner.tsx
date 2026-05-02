import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Button, Toast, SpinLoading, Dialog } from 'antd-mobile';
import styled from 'styled-components';
import ScannerComponent, { ScannerHandle } from '../components/Scanner';
import ScanResultList, { PendingItem } from '../components/ScanResultList';
import { scanApi } from '../services/api';

type ScanMode = 'idle' | 'borrow' | 'return';

const Container = styled.div`
  min-height: 100%;
  background: #f5f5f5;
`;

const Content = styled.div`
  padding: 16px;
`;

const ScanHint = styled.div`
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 8px;
  padding: 12px;
  margin-top: 16px;
  text-align: center;
  color: #0050b3;
  font-size: 14px;
`;

const BoxLink = styled.span`
  color: #1677ff;
  cursor: pointer;
  font-weight: 500;

  &:active {
    opacity: 0.7;
  }
`;

const BatchActionArea = styled.div`
  margin-top: 16px;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 12px;
`;

const LoadingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

export default function Scanner() {
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
      Toast.show({ content: '该物品已在列表中' });
      return;
    }
    setPendingItems(prev => [...prev, {
      itemId: item.item_id,
      itemName: item.item_name,
      itemImage: item.item_image,
      locationName: item.display_location_name || item.room_name || '未知位置',
      isInHand: item.isInHand || false,
      qrcode,
    }]);
    Toast.show({ content: `已添加「${item.item_name}」` });
  };

  const handleScan = async (qrcode: string): Promise<boolean> => {
    // 模式已确定时的处理
    if (mode === 'borrow') {
      if (qrcode.toLowerCase().startsWith('box.')) {
        Toast.show({ content: '已进入取走模式，请扫描物品二维码' });
        return false;
      }
      try {
        setScanLoading(true);
        const res: any = await scanApi.scan(qrcode);
        if (res.data.type !== 'item') {
          Toast.show({ icon: 'fail', content: '未识别到物品' });
          return false;
        }
        addItemToList(res.data.item, qrcode);
        return false;
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '识别失败' });
        return false;
      } finally {
        setScanLoading(false);
      }
    }

    if (mode === 'return') {
      if (qrcode.toLowerCase().startsWith('box.')) {
        Toast.show({ content: '已进入放入模式，请扫描物品二维码' });
        return false;
      }
      try {
        setScanLoading(true);
        const res: any = await scanApi.scan(qrcode);
        if (res.data.type !== 'item') {
          Toast.show({ icon: 'fail', content: '未识别到物品' });
          return false;
        }
        addItemToList(res.data.item, qrcode);
        return false;
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '识别失败' });
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
      Toast.show({ icon: 'fail', content: error.message || '扫描失败' });
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
      Toast.show({ content: '没有可取走的物品' });
      return;
    }

    scannerRef.current?.pause();
    const result = await Dialog.confirm({
      title: '确认取走',
      content: `确认取走 ${borrowableItems.length} 个物品？`,
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
        Toast.show({ icon: 'fail', content: `取走 ${totalSucceeded} 个成功，${totalFailed} 个失败` });
        const failedIds = res.data.results
          .filter((r: any) => !r.success)
          .map((r: any) => r.itemId);
        setPendingItems(prev => prev.filter(p => failedIds.includes(p.itemId)));
        scannerRef.current?.resume();
      } else {
        Toast.show({ icon: 'success', content: `成功取走 ${totalSucceeded} 个物品` });
        resetMode();
      }
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '批量取走失败' });
      scannerRef.current?.resume();
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchReturn = async () => {
    if (!returnTargetBox || pendingItems.length === 0) return;

    scannerRef.current?.pause();
    const result = await Dialog.confirm({
      title: '确认放入',
      content: `确认将 ${pendingItems.length} 个物品放入「${returnTargetBox.box_name}」？`,
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
        Toast.show({ icon: 'fail', content: `放入 ${totalSucceeded} 个成功，${totalFailed} 个失败` });
        const failedIds = res.data.results
          .filter((r: any) => !r.success)
          .map((r: any) => r.itemId);
        setPendingItems(prev => prev.filter(p => failedIds.includes(p.itemId)));
        scannerRef.current?.resume();
      } else {
        Toast.show({ icon: 'success', content: `成功放入 ${totalSucceeded} 个物品` });
        resetMode();
      }
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '批量放入失败' });
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

  const navTitle = mode === 'borrow' ? '扫码取走' : mode === 'return' ? '扫码放入' : '扫描二维码';

  const actionLabel = mode === 'borrow' ? '取走' : '放入';
  const actionCount = mode === 'borrow'
    ? pendingItems.filter(p => !p.isInHand).length
    : pendingItems.length;

  return (
    <Container>
      <NavBar onBack={() => navigate(-1)}>{navTitle}</NavBar>

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
            {mode === 'borrow' && '扫描物品二维码加入取走列表'}
            {mode === 'return' && (
              <>
                将物品放入{' '}
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
                取消
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

            <ScanResultList
              items={pendingItems}
              onRemoveItem={handleRemoveItem}
            />
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