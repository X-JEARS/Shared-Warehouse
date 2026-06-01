import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Input, Button, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { boxApi } from '../services/api';
import Scanner from '../components/Scanner';

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

const ScanModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--app-color-bg);
  z-index: 1000;
`;

export default function AddBox() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [formData, setFormData] = useState({
    qrcode: '',
    name: '',
  });

  const handleScanQrcode = (qrcode: string): boolean => {
    // 去除首尾空白字符
    const trimmedQrcode = qrcode.trim();

    // 验证二维码格式（不区分大小写）
    if (!trimmedQrcode.toLowerCase().startsWith('box.')) {
      Toast.show({
        icon: 'fail',
        content: `二维码格式不正确：${trimmedQrcode.substring(0, 20)}${trimmedQrcode.length > 20 ? '...' : ''}`
      });
      // 返回 false 表示继续扫描
      return false;
    }
    setFormData({ ...formData, qrcode: trimmedQrcode });
    setShowScanner(false);
    // 返回 true 表示停止扫描
    return true;
  };

  const handleSubmit = async () => {
    const qrcode = formData.qrcode.trim();

    if (!qrcode) {
      Toast.show({ content: '请输入或扫描二维码' });
      return;
    }

    // 验证二维码格式（不区分大小写）
    if (!qrcode.toLowerCase().startsWith('box.')) {
      Toast.show({ icon: 'fail', content: '盒子二维码必须以 box. 开头' });
      return;
    }

    if (!formData.name || !formData.name.trim()) {
      Toast.show({ content: '请输入盒子名称' });
      return;
    }

    try {
      setLoading(true);
      await boxApi.create(parseInt(id!), {
        qrcode,
        name: formData.name.trim(),
      });
      Toast.show({ icon: 'success', content: '添加成功' });
      navigate(-1);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '添加失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>添加盒子</HeaderTitle>
      </Header>

      <Content>
        <Form layout="horizontal">
          <Form.Item label="二维码" required>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                value={formData.qrcode}
                onChange={(v) => setFormData({ ...formData, qrcode: v })}
                placeholder="请扫描或输入二维码"
                style={{ flex: 1 }}
                maxLength={64}
              />
              <Button
                size="small"
                color="primary"
                onClick={() => setShowScanner(true)}
              >
                扫码
              </Button>
            </div>
          </Form.Item>

          <Form.Item label="名称" required>
            <Input
              value={formData.name}
              onChange={(v) => setFormData({ ...formData, name: v })}
              placeholder="请输入盒子名称"
              maxLength={24}
            />
          </Form.Item>
        </Form>

        <Button
          block
          color="primary"
          size="large"
          loading={loading}
          onClick={handleSubmit}
          style={{ marginTop: 24 }}
        >
          添加盒子
        </Button>
      </Content>

      {/* 扫码弹窗 */}
      {showScanner && (
        <ScanModal>
          <Header>
            <BackButton onClick={() => setShowScanner(false)}>←</BackButton>
            <HeaderTitle>扫描盒子二维码</HeaderTitle>
          </Header>
          <Content>
            <div style={{
              background: 'var(--app-color-warning-bg)',
              border: '1px solid var(--app-color-warning-border)',
              borderRadius: 'var(--app-radius-m)',
              padding: 12,
              marginBottom: 16,
              textAlign: 'center',
              color: 'var(--app-color-warning-text)',
              fontSize: 14,
            }}>
              请扫描盒子二维码（以 box. 开头）
            </div>
            <Scanner
              showStopButton
              onScan={handleScanQrcode}
              onError={(error) => {
                console.error('Scanner error:', error);
                Toast.show({ icon: 'fail', content: '扫描失败' });
              }}
            />
          </Content>
        </ScanModal>
      )}
    </Container>
  );
}
