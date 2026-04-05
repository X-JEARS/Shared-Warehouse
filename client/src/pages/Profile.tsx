import { useNavigate } from 'react-router-dom';
import { List, Button, Dialog, Toast } from 'antd-mobile';
import {
  SetOutline,
  InformationCircleOutline,
} from 'antd-mobile-icons';
import styled from 'styled-components';
import { useAuthStore } from '../stores/authStore';
import { userApi } from '../services/api';

const Container = styled.div`
  min-height: 100%;
  background: #f5f5f5;
`;

const Header = styled.div`
  background: white;
  padding: 24px 16px;
  text-align: center;
  margin-bottom: 12px;
`;

const Avatar = styled.div<{ $avatar?: string }>`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: ${(props) =>
    props.$avatar ? `url(${props.$avatar}) center/cover` : '#1677ff'};
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 32px;
`;

const Nickname = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #333;
`;

const LoginName = styled.div`
  font-size: 14px;
  color: #999;
  margin-top: 4px;
`;

const Section = styled.div`
  background: white;
  margin-bottom: 12px;
`;

const LogoutButton = styled(Button)`
  margin: 24px 16px;
  width: calc(100% - 32px);
  box-sizing: border-box;
`;

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Dialog.confirm({
      content: '确定要退出登录吗？',
      onConfirm: () => {
        logout();
        navigate('/login');
      },
    });
  };

  const handleChangePassword = async () => {
    const result = await Dialog.confirm({
      title: '修改密码',
      content: (
        <div>
          <input
            type="password"
            placeholder="当前密码"
            id="currentPassword"
            style={{
              width: '100%',
              padding: '12px 8px',
              margin: '8px 0',
              border: '1px solid #ddd',
              borderRadius: 4,
            }}
          />
          <input
            type="password"
            placeholder="新密码"
            id="newPassword"
            style={{
              width: '100%',
              padding: '12px 8px',
              margin: '8px 0',
              border: '1px solid #ddd',
              borderRadius: 4,
            }}
          />
        </div>
      ),
    });

    if (result) {
      const currentPassword = (document.getElementById('currentPassword') as HTMLInputElement)?.value;
      const newPassword = (document.getElementById('newPassword') as HTMLInputElement)?.value;

      if (!currentPassword || !newPassword) {
        Toast.show({ content: '请填写完整信息' });
        return;
      }

      try {
        await userApi.updatePassword({ currentPassword, newPassword });
        Toast.show({ icon: 'success', content: '密码修改成功' });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '修改失败' });
      }
    }
  };

  return (
    <Container>
      <Header>
        <Avatar $avatar={user?.user_avatar}>
          {user?.user_nickname?.charAt(0).toUpperCase() || 'U'}
        </Avatar>
        <Nickname>{user?.user_nickname || '未设置昵称'}</Nickname>
        <LoginName>@{user?.user_login_name}</LoginName>
      </Header>

      <Section>
        <List>
          <List.Item
            prefix={<span style={{ fontSize: 18 }}>📦</span>}
            onClick={() => navigate('/my-items')}
          >
            我的物品
          </List.Item>
          <List.Item
            prefix={<SetOutline />}
            onClick={() => Toast.show({ content: '功能开发中' })}
          >
            编辑资料
          </List.Item>
          <List.Item
            prefix={<span style={{ fontSize: 18 }}>🔒</span>}
            onClick={handleChangePassword}
          >
            修改密码
          </List.Item>
        </List>
      </Section>

      <Section>
        <List>
          <List.Item
            prefix={<InformationCircleOutline />}
            onClick={() =>
              Dialog.alert({
                title: '关于',
                content: '固定资产管理系统 v1.0.0\n扫码借还，高效管理',
              })
            }
          >
            关于
          </List.Item>
        </List>
      </Section>

      <LogoutButton
        block
        color="danger"
        fill="outline"
        onClick={handleLogout}
      >
        🚪 退出登录
      </LogoutButton>
    </Container>
  );
}
