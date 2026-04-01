import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Button, Card, Toast, SpinLoading } from 'antd-mobile';
import styled from 'styled-components';
import ScannerComponent from '../components/Scanner';
import { scanApi } from '../services/api';

const Container = styled.div`
  min-height: 100%;
  background: #f5f5f5;
`;

const Content = styled.div`
  padding: 16px;
`;

const ResultCard = styled(Card)`
  margin-top: 16px;
`;

const ItemInfo = styled.div`
  padding: 16px;
`;

const ItemName = styled.div`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
`;

const ItemMeta = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 4px;
`;

const ActionButtons = styled.div`
  margin-top: 16px;
`;

export default function Scanner() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const handleScan = async (qrcode: string) => {
    try {
      setLoading(true);
      setScanning(false);
      const res: any = await scanApi.scan(qrcode);
      setScanResult(res.data);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '扫描失败' });
      setScanning(true);
    } finally {
      setLoading(false);
    }
  };

  const handleTake = async () => {
    if (!scanResult?.item?.item_id) return;

    try {
      await scanApi.borrow(scanResult.item.item_id);
      Toast.show({ icon: 'success', content: '取走成功' });
      setScanResult(null);
      setScanning(true);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '取走失败' });
    }
  };

  return (
    <Container>
      <NavBar onBack={() => navigate(-1)}>扫描二维码</NavBar>

      <Content>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <SpinLoading />
            <p>识别中...</p>
          </div>
        ) : scanning ? (
          <ScannerComponent
            onScan={handleScan}
            onError={(error) => {
              console.error('Scanner error:', error);
            }}
          />
        ) : scanResult ? (
          <div>
            <ResultCard>
              <ItemInfo>
                {scanResult.type === 'box' ? (
                  <>
                    <ItemName>📦 {scanResult.box?.box_name || '盒子'}</ItemName>
                    <ItemMeta>盒子ID: {scanResult.box?.box_id}</ItemMeta>
                    <ItemMeta>
                      物品数量: {scanResult.items?.length || 0}
                    </ItemMeta>
                  </>
                ) : (
                  <>
                    <ItemName>
                      📦 {scanResult.item?.item_name}
                    </ItemName>
                    <ItemMeta>
                      位置: {scanResult.item?.room_name}
                      {scanResult.item?.box_name && ` / ${scanResult.item?.box_name}`}
                    </ItemMeta>
                    {scanResult.item?.currentHolder && (
                      <ItemMeta>
                        当前持有者: {scanResult.item.currentHolder.user_nickname}
                      </ItemMeta>
                    )}
                  </>
                )}
              </ItemInfo>
            </ResultCard>

            {scanResult.type === 'item' && (
              <ActionButtons>
                <Button
                  block
                  color="primary"
                  onClick={handleTake}
                  disabled={scanResult.item?.isInHand}
                >
                  {scanResult.item?.isInHand ? '已在手中' : '取走'}
                </Button>
              </ActionButtons>
            )}

            <Button
              block
              fill="outline"
              style={{ marginTop: 12 }}
              onClick={() => {
                setScanResult(null);
                setScanning(true);
              }}
            >
              继续扫描
            </Button>
          </div>
        ) : null}
      </Content>
    </Container>
  );
}
