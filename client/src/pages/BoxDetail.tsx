import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NavBar, Button, Card, Toast, SpinLoading, Dialog } from 'antd-mobile';
import styled from 'styled-components';
import ScannerComponent, { ScannerHandle } from '../components/Scanner';
import ScanResultList, { PendingItem } from '../components/ScanResultList';
import { boxApi, scanApi } from '../services/api';
import ItemCard from '../components/ItemCard';

const Container = styled.div`
  min-height: 100%;
  background: #f5f5f5;
`;

const Content = styled.div`
  padding: 16px;
`;

const BoxInfo = styled(Card)`
  margin-bottom: 16px;
`;

const BoxInfoContent = styled.div`
  padding: 16px;
`;

const BoxName = styled.div`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
`;

const BoxMeta = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 4px;
`;

const SectionTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 12px;
`;

const ItemList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
`;

const EmptyText = styled.div`
  text-align: center;
  color: #999;
  padding: 24px;
`;

const ScanModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f5f5f5;
  z-index: 1000;
  display: flex;
  flex-direction: column;
`;

const ScanModalContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
`;

const ScanHint = styled.div`
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  text-align: center;
  color: #0050b3;
  font-size: 14px;
`;

const BatchActionArea = styled.div`
  margin-top: 16px;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 12px;
`;

export default function BoxDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [box, setBox] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [itemLoading, setItemLoading] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const scannerRef = useRef<ScannerHandle>(null);

  useEffect(() => {
    loadBox();
  }, [id]);

  const loadBox = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res: any = await boxApi.getById(parseInt(id));
      setBox(res.data);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '加载失败' });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleScanItem = async (qrcode: string): Promise<boolean> => {
    // 验证是否为物品码（非盒子码）
    if (qrcode.toLowerCase().startsWith('box.')) {
      Toast.show({ icon: 'fail', content: '请扫描物品二维码' });
      return false;
    }

    // 去重检查
    const exists = pendingItems.some(p => p.qrcode === qrcode);
    if (exists) {
      Toast.show({ content: '该物品已在列表中' });
      return false;
    }

    try {
      setItemLoading(true);
      const res: any = await scanApi.scan(qrcode);

      if (res.data.type !== 'item') {
        Toast.show({ icon: 'fail', content: '未识别到物品' });
        return false;
      }

      const item = res.data.item;
      setPendingItems(prev => [...prev, {
        itemId: item.item_id,
        itemName: item.item_name,
        itemImage: item.item_image,
        locationName: item.display_location_name || item.room_name || '未知位置',
        isInHand: item.isInHand || false,
        qrcode,
      }]);
      Toast.show({ content: `已添加「${item.item_name}」` });
      return false; // 继续扫描
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '识别失败' });
      return false;
    } finally {
      setItemLoading(false);
    }
  };

  const handleRemoveItem = (qrcode: string) => {
    setPendingItems(prev => prev.filter(p => p.qrcode !== qrcode));
  };

  const handleBatchReturn = async () => {
    if (pendingItems.length === 0 || !box) return;

    scannerRef.current?.pause();
    const result = await Dialog.confirm({
      title: '确认放入',
      content: `确认将 ${pendingItems.length} 个物品放入「${box.box_name}」？`,
    });
    if (!result) {
      scannerRef.current?.resume();
      return;
    }

    setReturnLoading(true);
    try {
      const items = pendingItems.map(p => ({ itemId: p.itemId, boxId: box.box_id }));
      const res: any = await scanApi.returnBatch(items);
      const { totalSucceeded, totalFailed } = res.data;

      if (totalFailed > 0) {
        Toast.show({ icon: 'fail', content: `放入 ${totalSucceeded} 个成功，${totalFailed} 个失败` });
        // 移除成功的物品，保留失败的
        const failedIds = res.data.results
          .filter((r: any) => !r.success)
          .map((r: any) => r.itemId);
        setPendingItems(prev => prev.filter(p => failedIds.includes(p.itemId)));
      } else {
        Toast.show({ icon: 'success', content: `成功放入 ${totalSucceeded} 个物品` });
        setPendingItems([]);
        loadBox();
      }
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '批量放入失败' });
    } finally {
      setReturnLoading(false);
      scannerRef.current?.resume();
    }
  };

  const handleItemClick = (itemId: number) => {
    console.log('Item clicked:', itemId);
  };

  if (loading) {
    return (
      <Container>
        <NavBar onBack={() => navigate(-1)}>盒子详情</NavBar>
        <Content>
          <div style={{ textAlign: 'center', padding: 60 }}>
            <SpinLoading />
            <p>加载中...</p>
          </div>
        </Content>
      </Container>
    );
  }

  return (
    <Container>
      <NavBar onBack={() => navigate(-1)}>盒子详情</NavBar>

      <Content>
        <BoxInfo>
          <BoxInfoContent>
            <BoxName>📦 {box?.box_name}</BoxName>
            <BoxMeta>所属仓库: {box?.room_name || '个人盒子'}</BoxMeta>
            {box?.box_notice && (
              <BoxMeta>备注: {box.box_notice}</BoxMeta>
            )}
          </BoxInfoContent>
        </BoxInfo>

        <Button
          block
          color="primary"
          size="large"
          onClick={() => { setShowScanner(true); setPendingItems([]); }}
        >
          存入物品
        </Button>

        <SectionTitle style={{ marginTop: 24 }}>物品列表</SectionTitle>
        {box?.items?.length > 0 ? (
          <ItemList>
            {box.items.map((item: any) => (
              <ItemCard
                key={item.item_id}
                item={item}
                onClick={() => handleItemClick(item.item_id)}
              />
            ))}
          </ItemList>
        ) : (
          <EmptyText>盒子内暂无物品</EmptyText>
        )}
      </Content>

      {/* 扫码弹窗 */}
      {showScanner && (
        <ScanModal>
          <NavBar onBack={() => { setShowScanner(false); setPendingItems([]); }}>扫描物品</NavBar>
          <ScanModalContent>
            <ScanHint>
              请扫描要放入的物品二维码
            </ScanHint>
            <ScannerComponent
              ref={scannerRef}
              onScan={handleScanItem}
            />

            <BatchActionArea>
              <ButtonRow>
                <Button
                  block
                  fill="outline"
                  onClick={() => { setPendingItems([]); }}
                  style={{ flex: 1 }}
                >
                  取消
                </Button>
                <Button
                  block
                  color="primary"
                  disabled={pendingItems.length === 0}
                  loading={returnLoading}
                  onClick={handleBatchReturn}
                  style={{ flex: 1 }}
                >
                  放入 ({pendingItems.length})
                </Button>
              </ButtonRow>

              <ScanResultList
                items={pendingItems}
                onRemoveItem={handleRemoveItem}
              />
            </BatchActionArea>
          </ScanModalContent>

          {/* 加载中遮罩 */}
          {itemLoading && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
            }}>
              <SpinLoading />
            </div>
          )}
        </ScanModal>
      )}
    </Container>
  );
}