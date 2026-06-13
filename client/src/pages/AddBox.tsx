import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        content: t('addBox.qrcodeFormatError', { code: `${trimmedQrcode.substring(0, 20)}${trimmedQrcode.length > 20 ? '...' : ''}` })
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
      Toast.show({ content: t('addBox.qrcodeRequired') });
      return;
    }

    // 验证二维码格式（不区分大小写）
    if (!qrcode.toLowerCase().startsWith('box.')) {
      Toast.show({ icon: 'fail', content: t('addBox.boxQRCodePrefix') });
      return;
    }

    if (!formData.name || !formData.name.trim()) {
      Toast.show({ content: t('addBox.nameRequired') });
      return;
    }

    try {
      setLoading(true);
      await boxApi.create(parseInt(id!), {
        qrcode,
        name: formData.name.trim(),
      });
      Toast.show({ icon: 'success', content: t('addBox.addSuccess') });
      navigate(-1);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('addBox.addFailed') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>{t('addBox.title')}</HeaderTitle>
      </Header>

      <Content>
        <Form layout="horizontal">
          <Form.Item label={t('addBox.qrcode')} required>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                value={formData.qrcode}
                onChange={(v) => setFormData({ ...formData, qrcode: v })}
                placeholder={t('addBox.qrcodePlaceholder')}
                style={{ flex: 1 }}
                maxLength={64}
              />
              <Button
                size="small"
                color="primary"
                onClick={() => setShowScanner(true)}
              >
                {t('common.scanCode')}
              </Button>
            </div>
          </Form.Item>

          <Form.Item label={t('addBox.name')} required>
            <Input
              value={formData.name}
              onChange={(v) => setFormData({ ...formData, name: v })}
              placeholder={t('addBox.namePlaceholder')}
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
          {t('addBox.addBox')}
        </Button>
      </Content>

      {/* 扫码弹窗 */}
      {showScanner && (
        <ScanModal>
          <Header>
            <BackButton onClick={() => setShowScanner(false)}>←</BackButton>
            <HeaderTitle>{t('addBox.scanBoxQRCode')}</HeaderTitle>
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
              {t('addBox.scanBoxHint')}
            </div>
            <Scanner
              showStopButton
              onScan={handleScanQrcode}
              onError={(error) => {
                console.error('Scanner error:', error);
                Toast.show({ icon: 'fail', content: t('addBox.scanFailed') });
              }}
            />
          </Content>
        </ScanModal>
      )}
    </Container>
  );
}
