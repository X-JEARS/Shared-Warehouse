import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';

const Container = styled.div`
  min-height: 100%;
  background: var(--app-color-surface);
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
`;

const Logo = styled.div`
  text-align: center;
  margin-bottom: 40px;
`;

const LogoText = styled.h1`
  font-size: 28px;
  color: var(--app-color-primary);
  margin-bottom: 8px;
`;

const LogoSubtext = styled.p`
  font-size: 14px;
  color: var(--app-color-text-secondary);
`;

const FormContainer = styled.div`
  flex: 1;
`;

const Footer = styled.div`
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  color: var(--app-color-text-weak);
`;

const LinkText = styled.span`
  color: var(--app-color-primary);
`;

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const { setRooms } = useRoomStore();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    const values = form.getFieldsValue();

    if (!values.loginName || !values.password) {
      Toast.show({ content: '请填写用户名和密码' });
      return;
    }

    try {
      setLoading(true);
      const res: any = await authApi.login(values);
      login(res.data.user, res.data.token);
      // 清空旧的房间数据，进入仓库页面时会重新加载
      // 但保留 currentRoom 以记住用户上次访问的仓库
      setRooms([]);
      Toast.show({ icon: 'success', content: '登录成功' });
      navigate('/warehouse');
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '登录失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Logo>
        <LogoText>共享仓库</LogoText>
        <LogoSubtext>扫码借还，高效管理</LogoSubtext>
      </Logo>

      <FormContainer>
        <Form form={form} layout="horizontal">
          <Form.Item name="loginName" label="用户名">
            <Input placeholder="请输入用户名" clearable />
          </Form.Item>
          <Form.Item name="password" label="密码">
            <Input placeholder="请输入密码" type="password" clearable />
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
          登录
        </Button>
      </FormContainer>

      <Footer>
        还没有账号？{' '}
        <Link to="/register">
          <LinkText>立即注册</LinkText>
        </Link>
      </Footer>
    </Container>
  );
}
