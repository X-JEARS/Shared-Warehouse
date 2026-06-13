import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { roomApi } from '../services/api';

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

const Tip = styled.div`
  background: var(--app-color-warning-bg);
  border: 1px solid var(--app-color-warning-border);
  border-radius: var(--app-radius-m);
  padding: 12px;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--app-color-warning-text);
`;

const StatusCard = styled.div`
  background: var(--app-color-surface);
  border-radius: var(--app-radius-m);
  padding: 16px;
  margin-bottom: 16px;
`;

const StatusTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
`;

const StatusText = styled.div`
  font-size: 14px;
  color: var(--app-color-text-weak);
  margin-bottom: 4px;
`;

const StatusPending = styled.span`
  color: var(--app-color-warning-text);
`;

const StatusApproved = styled.span`
  color: var(--app-color-success);
`;

const StatusRejected = styled.span`
  color: var(--app-color-danger);
`;

interface JoinRequestStatus {
  request_id: number;
  request_status: 'pending' | 'approved' | 'rejected';
  request_create_time: number;
  request_member_name?: string;
}

export default function JoinRoom() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [requestStatus, setRequestStatus] = useState<JoinRequestStatus | null>(null);

  const checkRequestStatus = async (id: number) => {
    try {
      const response = await roomApi.getJoinRequestStatus(id);
      setRequestStatus(response.data);
    } catch (error) {
      console.error('Failed to check request status:', error);
    }
  };

  const handleJoin = async () => {
    if (!roomId.trim()) {
      Toast.show({ content: t('joinRoom.roomIdRequired') });
      return;
    }

    try {
      setLoading(true);
      await roomApi.requestJoin(parseInt(roomId), memberName.trim() || undefined);
      Toast.show({ icon: 'success', content: t('joinRoom.requestSubmitted') });
      await checkRequestStatus(parseInt(roomId));
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('joinRoom.requestFailed') });
    } finally {
      setLoading(false);
    }
  };

  const renderStatus = () => {
    if (!requestStatus) return null;

    const statusText = {
      pending: <StatusPending>{t('joinRoom.pending')}</StatusPending>,
      approved: <StatusApproved>{t('joinRoom.approved')}</StatusApproved>,
      rejected: <StatusRejected>{t('joinRoom.rejected')}</StatusRejected>,
    };

    return (
      <StatusCard>
        <StatusTitle>{t('joinRoom.currentStatus')}</StatusTitle>
        <StatusText>
          {t('joinRoom.statusLabel')} {statusText[requestStatus.request_status]}
        </StatusText>
        <StatusText>
          {t('joinRoom.requestTime')} {new Date(requestStatus.request_create_time).toLocaleString()}
        </StatusText>
        {requestStatus.request_status === 'rejected' && (
          <Button
            size="small"
            color="primary"
            style={{ marginTop: 12 }}
            onClick={handleJoin}
            loading={loading}
          >
            {t('joinRoom.reapply')}
          </Button>
        )}
      </StatusCard>
    );
  };

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>{t('joinRoom.title')}</HeaderTitle>
      </Header>

      <Content>
        <Tip>
          {t('joinRoom.tip')}
        </Tip>

        {renderStatus()}

        <Form layout="horizontal">
          <Form.Item label={t('joinRoom.roomId')} required>
            <Input
              value={roomId}
              onChange={setRoomId}
              placeholder={t('joinRoom.roomIdPlaceholder')}
              type="number"
            />
          </Form.Item>

          <Form.Item label={t('joinRoom.memberName')}>
            <Input
              value={memberName}
              onChange={setMemberName}
              placeholder={t('joinRoom.memberNamePlaceholder')}
              maxLength={16}
            />
          </Form.Item>
        </Form>

        <Button
          block
          color="primary"
          size="large"
          loading={loading}
          onClick={handleJoin}
          style={{ marginTop: 24 }}
        >
          {t('joinRoom.applyJoin')}
        </Button>
      </Content>
    </Container>
  );
}
