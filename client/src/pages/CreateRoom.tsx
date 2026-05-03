import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, TextArea, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { roomApi } from '../services/api';
import { useRoomStore } from '../stores/roomStore';

const Container = styled.div`
  min-height: 100%;
  background: #f5f5f5;
`;

const Header = styled.div`
  background: white;
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
`;

const BackButton = styled.div`
  font-size: 20px;
  margin-right: 12px;
  cursor: pointer;
  color: #333;
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
`;

const Content = styled.div`
  padding: 16px;
`;

export default function CreateRoom() {
  const navigate = useNavigate();
  const { addRoom } = useRoomStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    notice: '',
  });

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Toast.show({ content: '请输入仓库名称' });
      return;
    }

    try {
      setLoading(true);
      const res: any = await roomApi.create({
        name: formData.name.trim(),
        notice: formData.notice.trim() || undefined,
      });
      addRoom(res.data);
      Toast.show({ icon: 'success', content: '创建成功' });
      navigate(-1);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '创建失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>创建仓库</HeaderTitle>
      </Header>

      <Content>
        <Form layout="horizontal">
          <Form.Item label="仓库名称" required>
            <Input
              value={formData.name}
              onChange={(v) => setFormData({ ...formData, name: v })}
              placeholder="请输入仓库名称"
              maxLength={24}
            />
          </Form.Item>

          <Form.Item label="仓库公告">
            <TextArea
              value={formData.notice}
              onChange={(v) => setFormData({ ...formData, notice: v })}
              placeholder="仓库公告（可选）"
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
          创建仓库
        </Button>
      </Content>
    </Container>
  );
}
