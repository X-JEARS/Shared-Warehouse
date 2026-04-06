import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { authApi } from '../services/api';

const Container = styled.div`
  min-height: 100%;
  background: white;
  padding: 40px 24px;
`;

const Logo = styled.div`
  text-align: center;
  margin-bottom: 40px;
`;

const LogoText = styled.h1`
  font-size: 28px;
  color: #1677ff;
  margin-bottom: 8px;
`;

const LogoSubtext = styled.p`
  font-size: 14px;
  color: #999;
`;

const Footer = styled.div`
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  color: #666;
`;

const LinkText = styled.span`
  color: #1677ff;
`;

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    const values = form.getFieldsValue();

    if (!values.loginName || !values.password) {
      Toast.show({ content: '请填写用户名和密码' });
      return;
    }

    if (values.password !== values.confirmPassword) {
      Toast.show({ content: '两次密码输入不一致' });
      return;
    }

    if (values.password.length < 6) {
      Toast.show({ content: '密码长度至少6位' });
      return;
    }

    try {
      setLoading(true);
      await authApi.register({
        loginName: values.loginName,
        password: values.password,
        nickname: values.nickname,
        tel: values.tel,
      });
      Toast.show({ icon: 'success', content: '注册成功，请登录' });
      navigate('/login');
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '注册失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Logo>
        <LogoText>创建账号</LogoText>
        <LogoSubtext>加入共享仓库</LogoSubtext>
      </Logo>

      <Form form={form} layout="horizontal">
        <Form.Item name="loginName" label="用户名" rules={[{ required: true }]}>
          <Input placeholder="字母和数字，最多16位" clearable />
        </Form.Item>
        <Form.Item name="password" label="密码" rules={[{ required: true }]}>
          <Input placeholder="至少6位" type="password" clearable />
        </Form.Item>
        <Form.Item name="confirmPassword" label="确认密码">
          <Input placeholder="再次输入密码" type="password" clearable />
        </Form.Item>
        <Form.Item name="nickname" label="昵称">
          <Input placeholder="选填，最多16位" clearable />
        </Form.Item>
        <Form.Item name="tel" label="电话">
          <Input placeholder="选填" clearable />
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
        注册
      </Button>

      <Footer>
        已有账号？{' '}
        <Link to="/login">
          <LinkText>立即登录</LinkText>
        </Link>
      </Footer>
    </Container>
  );
}
