import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Toast, SpinLoading, Dialog } from 'antd-mobile';
import { DetailSkeleton, ItemCardSkeleton } from '../components/skeleton';
import { useMinLoadingTime } from '../hooks/useMinLoadingTime';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import ScannerComponent, { ScannerHandle } from '../components/Scanner';
import ScanResultList, { PendingItem } from '../components/ScanResultList';
import { boxApi, scanApi } from '../services/api';
import ItemCard from '../components/ItemCard';

const Container = styled.div`
  min-height: 100%;
  background: var(--app-color-bg);
`;

const Header = styled.div`
  background: var(--app-color-surface);
  padding: 8px 16px;
  border-bottom: 1px solid var(--app-color-border);
  display: flex;
  align-items: center;
`;

const BackButton = styled.div`
  font-size: 20px;
  margin-right: 12px;
  cursor: pointer;
  color: var(--app-color-text);
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
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
  color: var(--app-color-text-weak);
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
  color: var(--app-color-text-secondary);
  padding: 24px;
`;

const ScanModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--app-color-bg);
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
  background: var(--app-color-info-bg);
  border: 1px solid var(--app-color-info-border);
  border-radius: var(--app-radius-m);
  padding: 12px;
  margin-bottom: 16px;
  text-align: center;
  color: var(--app-color-info-text);
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
  const { t } = useTranslation();
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
      Toast.show({ icon: 'fail', content: error.message || t('boxDetail.loadFailed') });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleScanItem = async (qrcode: string): Promise<boolean> => {
    // 验证是否为物品码（非盒子码）
    if (qrcode.toLowerCase().startsWith('box.')) {
      Toast.show({ icon: 'fail', content: t('boxDetail.scanItemQRCode') });
      return false;
    }

    // 去重检查
    const exists = pendingItems.some(p => p.qrcode === qrcode);
    if (exists) {
      Toast.show({ content: t('boxDetail.itemInList') });
      return false;
    }

    try {
      setItemLoading(true);
      const res: any = await scanApi.scan(qrcode);

      if (res.data.type !== 'item') {
        Toast.show({ icon: 'fail', content: t('boxDetail.notItem') });
        return false;
      }

      const item = res.data.item;
      setPendingItems(prev => [...prev, {
        itemId: item.item_id,
        itemName: item.item_name,
        itemImage: item.item_image,
        locationName: item.display_location_name || item.room_name || t('common.unknown'),
        isInHand: item.isInHand || false,
        qrcode,
      }]);
      Toast.show({ content: t('boxDetail.itemAdded', { name: item.item_name }) });
      return false; // 继续扫描
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('boxDetail.scanFailed') });
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
      title: t('boxDetail.confirmReturn'),
      content: t('boxDetail.confirmReturnContent', { count: pendingItems.length, boxName: box.box_name }),
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
        Toast.show({ icon: 'fail', content: t('boxDetail.returnPartialSuccess', { succeeded: totalSucceeded, failed: totalFailed }) });
        // 移除成功的物品，保留失败的
        const failedIds = res.data.results
          .filter((r: any) => !r.success)
          .map((r: any) => r.itemId);
        setPendingItems(prev => prev.filter(p => failedIds.includes(p.itemId)));
      } else {
        Toast.show({ icon: 'success', content: t('boxDetail.returnSuccess', { count: totalSucceeded }) });
        setPendingItems([]);
        loadBox();
      }
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('boxDetail.batchReturnFailed') });
    } finally {
      setReturnLoading(false);
      scannerRef.current?.resume();
    }
  };

  const handleItemClick = (itemId: number) => {
    console.log('Item clicked:', itemId);
  };

  const showSkeleton = useMinLoadingTime(loading);

  if (showSkeleton) {
    return (
      <Container>
        <Header>
          <BackButton onClick={() => navigate(-1)}>←</BackButton>
          <HeaderTitle>{t('boxDetail.title')}</HeaderTitle>
        </Header>
        <Content>
          <DetailSkeleton />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginTop: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <ItemCardSkeleton key={i} />)}
          </div>
        </Content>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>{t('boxDetail.title')}</HeaderTitle>
      </Header>

      <Content>
        <BoxInfo>
          <BoxInfoContent>
            <BoxName>📦 {box?.box_name}</BoxName>
            <BoxMeta>{t('boxDetail.belongToRoom')}{box?.room_name || t('boxDetail.personalBox')}</BoxMeta>
            {box?.box_notice && (
              <BoxMeta>{t('boxDetail.notice')}{box.box_notice}</BoxMeta>
            )}
          </BoxInfoContent>
        </BoxInfo>

        <Button
          block
          color="primary"
          size="large"
          onClick={() => { setShowScanner(true); setPendingItems([]); }}
        >
          {t('boxDetail.depositItems')}
        </Button>

        <SectionTitle style={{ marginTop: 24 }}>{t('boxDetail.itemList')}</SectionTitle>
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
          <EmptyText>{t('boxDetail.noItems')}</EmptyText>
        )}
      </Content>

      {/* 扫码弹窗 */}
      {showScanner && (
        <ScanModal>
          <Header>
            <BackButton onClick={() => { setShowScanner(false); setPendingItems([]); }}>←</BackButton>
            <HeaderTitle>{t('boxDetail.scanItems')}</HeaderTitle>
          </Header>
          <ScanModalContent>
            <ScanHint>
              {t('boxDetail.scanItemHint')}
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
                  {t('common.cancel')}
                </Button>
                <Button
                  block
                  color="primary"
                  disabled={pendingItems.length === 0}
                  loading={returnLoading}
                  onClick={handleBatchReturn}
                  style={{ flex: 1 }}
                >
                  {t('boxDetail.putIn', { count: pendingItems.length })}
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
              background: 'var(--app-color-overlay)',
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
