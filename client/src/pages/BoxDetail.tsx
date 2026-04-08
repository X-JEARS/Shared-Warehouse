import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NavBar, Button, Card, Toast, SpinLoading, Dialog } from 'antd-mobile';
import styled from 'styled-components';
import ScannerComponent from '../components/Scanner';
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

export default function BoxDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [box, setBox] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [pendingItem, setPendingItem] = useState<any>(null);
  const [itemLoading, setItemLoading] = useState(false);

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

    try {
      setItemLoading(true);
      const res: any = await scanApi.scan(qrcode);

      if (res.data.type !== 'item') {
        Toast.show({ icon: 'fail', content: '未识别到物品' });
        return false;
      }

      // 弹出确认提示
      setPendingItem(res.data.item);
      return false; // 继续扫描，不关闭扫码器
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '识别失败' });
      return false;
    } finally {
      setItemLoading(false);
    }
  };

  const confirmPutItem = async () => {
    if (!pendingItem || !box) return;

    try {
      await scanApi.returnItem(pendingItem.item_id, box.box_id);
      Toast.show({ icon: 'success', content: '放入成功' });
      setPendingItem(null);
      loadBox(); // 刷新盒子物品列表
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '放入失败' });
    }
  };

  const handleItemClick = (itemId: number) => {
    // 可以跳转到物品详情或显示弹窗
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
            <BoxMeta>物品数量: {box?.items?.length || 0}</BoxMeta>
            {box?.box_notice && (
              <BoxMeta>备注: {box.box_notice}</BoxMeta>
            )}
          </BoxInfoContent>
        </BoxInfo>

        <SectionTitle>物品列表</SectionTitle>
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

        <Button
          block
          color="primary"
          size="large"
          style={{ marginTop: 24 }}
          onClick={() => setShowScanner(true)}
        >
          存入物品
        </Button>
      </Content>

      {/* 扫码弹窗 */}
      {showScanner && (
        <ScanModal>
          <NavBar onBack={() => setShowScanner(false)}>扫描物品</NavBar>
          <Content>
            <ScanHint>
              请扫描要放入的物品二维码
            </ScanHint>
            <ScannerComponent
              onScan={handleScanItem}
              onError={(error) => {
                console.error('Scanner error:', error);
                Toast.show({ icon: 'fail', content: '扫描失败' });
              }}
            />
          </Content>
        </ScanModal>
      )}

      {/* 确认放入弹窗 */}
      {pendingItem && (
        <Dialog
          visible={true}
          title="确认放入"
          content={
            <div>
              <p>是否将物品「{pendingItem.item_name}」放入盒子「{box?.box_name}」?</p>
            </div>
          }
          closeOnMaskClick={false}
          actions={[
            {
              key: 'cancel',
              text: '取消',
              onClick: () => setPendingItem(null),
            },
            {
              key: 'confirm',
              text: '确认',
              bold: true,
              onClick: confirmPutItem,
            },
          ]}
        />
      )}

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
    </Container>
  );
}
