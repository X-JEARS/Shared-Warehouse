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

export default function JoinRoom() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [memberName, setMemberName] = useState('');

  const handleJoin = async () => {
    if (!roomId.trim()) {
      Toast.show({ content: '请输入仓库ID' });
      return;
    }

    try {
      setLoading(true);
      await roomApi.join(parseInt(roomId), memberName.trim() || undefined);
      // 刷新仓库列表
      await roomApi.getAll();
      Toast.show({ icon: 'success', content: '加入成功' });
      navigate(-1);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '加入失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <NavBar onBack={() => navigate(-1)}>加入仓库</NavBar>

      <Content>
        <Tip>
          💡 请向仓库管理员获取仓库ID，         </Tip>

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
          加入仓库
        </Button>
      </Content>
    </Container>
  );
}
