import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, TextArea, Toast, Selector } from 'antd-mobile';
import styled from 'styled-components';
import { itemApi, boxApi, tagApi } from '../services/api';
import { useRoomStore } from '../stores/roomStore';
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

const WarningBox = styled.div`
  background: var(--app-color-warning-bg);
  border: 1px solid var(--app-color-warning-border);
  border-radius: var(--app-radius-m);
  padding: 16px;
  margin-bottom: 16px;
  text-align: center;
`;

const WarningTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: var(--app-color-warning-text);
  margin-bottom: 8px;
`;

const WarningText = styled.div`
  font-size: 14px;
  color: var(--app-color-warning-text);
  margin-bottom: 12px;
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

export default function CreateItem() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentRoom } = useRoomStore();
  const [loading, setLoading] = useState(false);
  const [boxes, setBoxes] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loadingBoxes, setLoadingBoxes] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [formData, setFormData] = useState({
    qrcode: '',
    name: '',
    boxId: '',
    tagIds: [] as number[],
    notice: '',
  });

  // 加载盒子和标签列表
  useEffect(() => {
    if (currentRoom) {
      setLoadingBoxes(true);
      Promise.all([
        boxApi.getByRoom(currentRoom.room_id),
        tagApi.getByRoom(currentRoom.room_id),
      ])
        .then(([boxesRes, tagsRes]: any[]) => {
          setBoxes(boxesRes.data || []);
          setTags(tagsRes.data || []);
          // 默认选择第一个盒子
          if (boxesRes.data?.length > 0) {
            setFormData(prev => ({
              ...prev,
              boxId: boxesRes.data[0].box_id.toString(),
            }));
          }
        })
        .catch((err) => {
          console.error('Failed to load data:', err);
        })
        .finally(() => {
          setLoadingBoxes(false);
        });
    }
  }, [currentRoom]);

  const handleScanQrcode = (qrcode: string): boolean => {
    // 验证二维码不能是box.开头
    if (qrcode.startsWith('box.')) {
      Toast.show({ icon: 'fail', content: t('createItem.itemQRCodeNotBox') });
      // 返回 false 继续扫描
      return false;
    }
    setFormData({ ...formData, qrcode });
    setShowScanner(false);
    return true;
  };

  const handleSubmit = async () => {
    if (!formData.qrcode || !formData.name || !formData.boxId) {
      Toast.show({ content: t('createItem.fillRequired') });
      return;
    }

    // 再次验证二维码
    if (formData.qrcode.startsWith('box.')) {
      Toast.show({ icon: 'fail', content: t('createItem.itemQRCodeNotBox') });
      return;
    }

    try {
      setLoading(true);
      // 创建物品
      const res: any = await itemApi.create({
        qrcode: formData.qrcode,
        name: formData.name,
        boxId: parseInt(formData.boxId),
        notice: formData.notice || undefined,
      });

      // 如果选择了标签，设置标签
      if (formData.tagIds.length > 0 && currentRoom) {
        try {
          await itemApi.setTags(res.data.item_id, currentRoom.room_id, formData.tagIds);
        } catch (tagError) {
          console.error('Failed to set tags:', tagError);
          // 标签设置失败不影响物品创建成功
        }
      }

      Toast.show({ icon: 'success', content: t('createItem.createSuccess') });
      navigate(-1);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('createItem.createFailed') });
    } finally {
      setLoading(false);
    }
  };

  // 没有选择仓库
  if (!currentRoom) {
    return (
      <Container>
        <Header>
          <BackButton onClick={() => navigate(-1)}>←</BackButton>
          <HeaderTitle>{t('createItem.title')}</HeaderTitle>
        </Header>
        <Content>
          <WarningBox>
            <WarningTitle>{t('createItem.selectRoomFirst')}</WarningTitle>
            <WarningText>{t('createItem.selectRoomDesc')}</WarningText>
            <Button color="primary" onClick={() => navigate('/warehouse')}>
              {t('createItem.backToWarehouse')}
            </Button>
          </WarningBox>
        </Content>
      </Container>
    );
  }

  // 加载中
  if (loadingBoxes) {
    return (
      <Container>
        <Header>
          <BackButton onClick={() => navigate(-1)}>←</BackButton>
          <HeaderTitle>{t('createItem.title')}</HeaderTitle>
        </Header>
        <Content style={{ textAlign: 'center', paddingTop: 40 }}>
          {t('common.loading')}
        </Content>
      </Container>
    );
  }

  // 没有盒子
  if (boxes.length === 0) {
    return (
      <Container>
        <Header>
          <BackButton onClick={() => navigate(-1)}>←</BackButton>
          <HeaderTitle>{t('createItem.title')}</HeaderTitle>
        </Header>
        <Content>
          <WarningBox>
            <WarningTitle>{t('createItem.noBoxes')}</WarningTitle>
            <WarningText>
              {t('createItem.noBoxesDesc')}
            </WarningText>
            {currentRoom?.is_admin && (
              <Button
                color="primary"
                onClick={() => navigate(`/room-settings/${currentRoom.room_id}`)}
              >
                {t('createItem.goAddBox')}
              </Button>
            )}
          </WarningBox>
        </Content>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>{t('createItem.title')}</HeaderTitle>
      </Header>

      <Content>
        <Form layout="horizontal">
          <Form.Item label={t('createItem.qrcode')} required>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                value={formData.qrcode}
                onChange={(v) => setFormData({ ...formData, qrcode: v })}
                placeholder={t('createItem.qrcodePlaceholder')}
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

          <Form.Item label={t('createItem.itemName')} required>
            <Input
              value={formData.name}
              onChange={(v) => setFormData({ ...formData, name: v })}
              placeholder={t('createItem.itemNamePlaceholder')}
              maxLength={24}
            />
          </Form.Item>

          <Form.Item label={t('createItem.storageLocation')} required>
            <Selector
              options={boxes.map((b) => ({
                label: b.box_name || t('createItem.boxId', { id: b.box_id }),
                value: b.box_id.toString(),
              }))}
              value={formData.boxId ? [formData.boxId] : []}
              onChange={(arr) => setFormData({ ...formData, boxId: arr[0] || '' })}
              style={{ '--gap': '8px' }}
            />
          </Form.Item>

          {tags.length > 0 && (
            <Form.Item label={t('createItem.tags')}>
              <Selector
                options={tags.map((tag) => ({
                  label: tag.tag_name,
                  value: tag.tag_id.toString(),
                }))}
                value={formData.tagIds.map(String)}
                onChange={(arr) =>
                  setFormData({
                    ...formData,
                    tagIds: arr.map(Number),
                  })
                }
                multiple
                style={{ '--gap': '8px' }}
              />
            </Form.Item>
          )}

          <Form.Item label={t('createItem.remark')}>
            <TextArea
              value={formData.notice}
              onChange={(v) => setFormData({ ...formData, notice: v })}
              placeholder={t('createItem.remarkPlaceholder')}
              maxLength={120}
              rows={3}
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
          {t('createItem.createItem')}
        </Button>
      </Content>

      {/* 扫码弹窗 */}
      {showScanner && (
        <ScanModal>
          <Header>
            <BackButton onClick={() => setShowScanner(false)}>←</BackButton>
            <HeaderTitle>{t('createItem.scanItemQRCode')}</HeaderTitle>
          </Header>
          <Content>
            <Scanner
              showStopButton
              onScan={handleScanQrcode}
              onError={(error) => {
                console.error('Scanner error:', error);
                Toast.show({ icon: 'fail', content: t('createItem.scanFailed') });
              }}
            />
          </Content>
        </ScanModal>
      )}
    </Container>
  );
}
