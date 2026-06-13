import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { authApi } from '../services/api';

const Container = styled.div`
  min-height: 100%;
  background: var(--app-color-surface);
  padding: 40px 24px;
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

const Footer = styled.div`
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  color: var(--app-color-text-weak);
`;

const LinkText = styled.span`
  color: var(--app-color-primary);
`;

export default function Register() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    const values = form.getFieldsValue();

    if (!values.loginName || !values.password) {
      Toast.show({ content: t('register.fillRequired') });
      return;
    }

    if (values.password !== values.confirmPassword) {
      Toast.show({ content: t('register.passwordMismatch') });
      return;
    }

    if (values.password.length < 6) {
      Toast.show({ content: t('register.passwordTooShort') });
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
      Toast.show({ icon: 'success', content: t('register.registerSuccess') });
      navigate('/login');
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('register.registerFailed') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Logo>
        <LogoText>{t('register.title')}</LogoText>
        <LogoSubtext>{t('register.subtitle')}</LogoSubtext>
      </Logo>

      <Form form={form} layout="horizontal">
        <Form.Item name="loginName" label={t('register.username')} rules={[{ required: true }]}>
          <Input placeholder={t('register.usernamePlaceholder')} clearable />
        </Form.Item>
        <Form.Item name="password" label={t('register.password')} rules={[{ required: true }]}>
          <Input placeholder={t('register.passwordPlaceholder')} type="password" clearable />
        </Form.Item>
        <Form.Item name="confirmPassword" label={t('register.confirmPassword')}>
          <Input placeholder={t('register.confirmPasswordPlaceholder')} type="password" clearable />
        </Form.Item>
        <Form.Item name="nickname" label={t('register.nickname')}>
          <Input placeholder={t('register.nicknamePlaceholder')} clearable />
        </Form.Item>
        <Form.Item name="tel" label={t('register.phone')}>
          <Input placeholder={t('register.phonePlaceholder')} clearable />
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
        {t('register.submit')}
      </Button>

      <Footer>
        {t('register.hasAccount')}{' '}
        <Link to="/login">
          <LinkText>{t('register.loginNow')}</LinkText>
        </Link>
      </Footer>
    </Container>
  );
}
