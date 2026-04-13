import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Form, Input, Button, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { roomApi } from '../services/api';

const Container = styled.div`
  min-height: 100%;
  background: #f5f5f5;
`;

const Content = styled.div`
  padding: 16px;
`;

const Tip = styled.div`
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #856404;
`;

const StatusCard = styled.div`
  background: #fff;
  border-radius: 8px;
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
  color: #666;
  margin-bottom: 4px;
`;

const StatusPending = styled.span`
  color: #faad14;
`;

const StatusApproved = styled.span`
  color: #52c41a;
`;

const StatusRejected = styled.span`
  color: #ff4d4f;
`;

interface JoinRequestStatus {
  request_id: number;
  request_status: 'pending' | 'approved' | 'rejected';
  request_create_time: number;
  request_member_name?: string;
}

export default function JoinRoom() {
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
      Toast.show({ content: '请输入仓库ID' });
      return;
    }

    try {
      setLoading(true);
      await roomApi.requestJoin(parseInt(roomId), memberName.trim() || undefined);
      Toast.show({ icon: 'success', content: '申请已提交，等待管理员审批' });
      await checkRequestStatus(parseInt(roomId));
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '申请失败' });
    } finally {
      setLoading(false);
    }
  };

  const renderStatus = () => {
    if (!requestStatus) return null;

    const statusText = {
      pending: <StatusPending>等待审批</StatusPending>,
      approved: <StatusApproved>已通过</StatusApproved>,
      rejected: <StatusRejected>已拒绝</StatusRejected>,
    };

    return (
      <StatusCard>
        <StatusTitle>当前申请状态</StatusTitle>
        <StatusText>
          状态: {statusText[requestStatus.request_status]}
        </StatusText>
        <StatusText>
          申请时间: {new Date(requestStatus.request_create_time).toLocaleString()}
        </StatusText>
        {requestStatus.request_status === 'rejected' && (
          <Button
            size="small"
            color="primary"
            style={{ marginTop: 12 }}
            onClick={handleJoin}
            loading={loading}
          >
            重新申请
          </Button>
        )}
      </StatusCard>
    );
  };

  return (
    <Container>
      <NavBar onBack={() => navigate(-1)}>加入仓库</NavBar>

      <Content>
        <Tip>
          💡 请向仓库管理员获取仓库ID，提交申请后需等待管理员审批
        </Tip>

        {renderStatus()}

        <Form layout="horizontal">
          <Form.Item label="仓库ID" required>
            <Input
              value={roomId}
              onChange={setRoomId}
              placeholder="请输入仓库ID"
              type="number"
            />
          </Form.Item>

          <Form.Item label="成员名称">
            <Input
              value={memberName}
              onChange={setMemberName}
              placeholder="在仓库中显示的名称（可选）"
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
          申请加入
        </Button>
      </Content>
    </Container>
  );
}
