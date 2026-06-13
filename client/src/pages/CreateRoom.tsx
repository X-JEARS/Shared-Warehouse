import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, TextArea, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { roomApi } from '../services/api';
import { useRoomStore } from '../stores/roomStore';

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

export default function CreateRoom() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addRoom } = useRoomStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    notice: '',
  });

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Toast.show({ content: t('createRoom.roomNameRequired') });
      return;
    }

    try {
      setLoading(true);
      const res: any = await roomApi.create({
        name: formData.name.trim(),
        notice: formData.notice.trim() || undefined,
      });
      addRoom(res.data);
      Toast.show({ icon: 'success', content: t('createRoom.createSuccess') });
      navigate(-1);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('createRoom.createFailed') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>{t('createRoom.title')}</HeaderTitle>
      </Header>

      <Content>
        <Form layout="horizontal">
          <Form.Item label={t('createRoom.roomName')} required>
            <Input
              value={formData.name}
              onChange={(v) => setFormData({ ...formData, name: v })}
              placeholder={t('createRoom.roomNamePlaceholder')}
              maxLength={24}
            />
          </Form.Item>

          <Form.Item label={t('createRoom.roomNotice')}>
            <TextArea
              value={formData.notice}
              onChange={(v) => setFormData({ ...formData, notice: v })}
              placeholder={t('createRoom.roomNoticePlaceholder')}
              maxLength={240}
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
          {t('createRoom.createRoom')}
        </Button>
      </Content>
    </Container>
  );
}
