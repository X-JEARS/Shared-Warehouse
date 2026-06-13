import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Toast } from 'antd-mobile';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const login = useAuthStore((state) => state.login);
  const { setRooms } = useRoomStore();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    const values = form.getFieldsValue();

    if (!values.loginName || !values.password) {
      Toast.show({ content: t('login.fillRequired') });
      return;
    }

    try {
      setLoading(true);
      const res: any = await authApi.login(values);
      login(res.data.user, res.data.token);
      setRooms([]);
      Toast.show({ icon: 'success', content: t('login.loginSuccess') });
      navigate('/warehouse');
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || t('login.loginFailed') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Logo>
        <LogoText>{t('login.title')}</LogoText>
        <LogoSubtext>{t('login.subtitle')}</LogoSubtext>
      </Logo>

      <FormContainer>
        <Form form={form} layout="horizontal">
          <Form.Item name="loginName" label={t('login.username')}>
            <Input placeholder={t('login.usernamePlaceholder')} clearable />
          </Form.Item>
          <Form.Item name="password" label={t('login.password')}>
            <Input placeholder={t('login.passwordPlaceholder')} type="password" clearable />
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
          {t('login.submit')}
        </Button>
      </FormContainer>

      <Footer>
        {t('login.noAccount')}{' '}
        <Link to="/register">
          <LinkText>{t('login.registerNow')}</LinkText>
        </Link>
      </Footer>
    </Container>
  );
}
