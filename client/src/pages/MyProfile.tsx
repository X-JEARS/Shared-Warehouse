import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Toast, Popup, Input } from 'antd-mobile';
import ReactCrop from 'react-image-crop';
import { makeAspectCrop, centerCrop, convertToPixelCrop, Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import styled from 'styled-components';
import { useAuthStore } from '../stores/authStore';
import { userApi } from '../services/api';

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

const Section = styled.div`
  background: var(--app-color-surface);
  margin-top: 12px;
`;

const ProfileRow = styled.div`
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--app-color-border);
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:active {
    background: var(--app-color-hover);
  }
`;

const RowLabel = styled.div`
  font-size: 14px;
  color: var(--app-color-text);
  min-width: 60px;
`;

const RowValue = styled.div`
  font-size: 14px;
  color: var(--app-color-text-secondary);
  flex: 1;
  text-align: right;
  margin-right: 8px;
`;

const RowArrow = styled.div`
  color: var(--app-color-placeholder);
  font-size: 14px;
`;

const AvatarWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const Avatar = styled.div<{ $avatar?: string }>`
  width: 40px;
  height: 40px;
  border-radius: var(--app-radius-avatar);
  background: ${(props) =>
    props.$avatar ? `url(${props.$avatar}) center/cover` : 'var(--app-color-avatar-default)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
`;

const CropContainer = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const CropActions = styled.div`
  display: flex;
  gap: 16px;
  margin-top: 16px;
  width: 100%;
`;

const CropButton = styled.button<{ $primary?: boolean }>`
  flex: 1;
  padding: 12px;
  border: ${(props) => (props.$primary ? 'none' : '1px solid var(--app-color-border)')};
  border-radius: var(--app-radius-m);
  background: ${(props) => (props.$primary ? 'var(--app-color-primary)' : 'var(--app-color-surface)')};
  color: ${(props) => (props.$primary ? 'white' : 'var(--app-color-text)')};
  font-size: 16px;
  cursor: pointer;
`;

const HiddenInput = styled.input`
  display: none;
`;

const LogoutButton = styled.button`
  margin: 24px 16px;
  width: calc(100% - 32px);
  padding: 12px;
  border: none;
  border-radius: var(--app-radius-m);
  background: var(--app-color-danger);
  color: white;
  font-size: 16px;
  cursor: pointer;
`;

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 100,
      },
      1,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

export default function MyProfile() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropPopupVisible, setCropPopupVisible] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now());
  const imgRef = useRef<HTMLImageElement>(null);

  const avatarUrl = user?.user_avatar
    ? `${user.user_avatar}?t=${avatarTimestamp}`
    : undefined;

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Toast.show({ icon: 'fail', content: '请选择图片文件' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCropPopupVisible(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
    const { width: renderWidth, height: renderHeight } = e.currentTarget;
    const newCrop = centerAspectCrop(width, height);
    setCrop(newCrop);
    const pixelCrop = convertToPixelCrop(newCrop, renderWidth, renderHeight);
    setCompletedCrop(pixelCrop);
  };

  const getCroppedImg = useCallback(async (): Promise<File | null> => {
    if (!imgRef.current || !completedCrop) return null;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const targetSize = 200;
    canvas.width = targetSize;
    canvas.height = targetSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      targetSize,
      targetSize
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
            resolve(file);
          } else {
            resolve(null);
          }
        },
        'image/jpeg',
        0.8
      );
    });
  }, [completedCrop]);

  const handleCropConfirm = async () => {
    try {
      const croppedFile = await getCroppedImg();
      if (!croppedFile) {
        Toast.show({ icon: 'fail', content: '请先选择裁剪区域' });
        return;
      }

      const formData = new FormData();
      formData.append('avatar', croppedFile);

      const res: any = await userApi.uploadAvatar(formData);
      updateUser({ user_avatar: res.data.avatar });
      setAvatarTimestamp(Date.now());
      Toast.show({ icon: 'success', content: '头像更新成功' });
      setCropPopupVisible(false);
      setImageSrc(null);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '更新失败' });
    }
  };

  const handleEditNickname = async () => {
    const currentValue = user?.user_nickname || '';

    const result = await Dialog.confirm({
      title: '修改昵称',
      content: (
        <Input
          id="nickname-input"
          placeholder="请输入昵称"
          defaultValue={currentValue}
          maxLength={16}
          style={{ '--font-size': '16px' }}
        />
      ),
    });

    if (!result) return;

    const input = document.getElementById('nickname-input') as HTMLInputElement;
    const newNickname = input?.value?.trim();

    if (!newNickname) {
      Toast.show({ content: '昵称不能为空' });
      return;
    }

    if (newNickname.length > 16) {
      Toast.show({ content: '昵称最多16个字符' });
      return;
    }

    try {
      await userApi.updateProfile({ nickname: newNickname });
      updateUser({ user_nickname: newNickname });
      Toast.show({ icon: 'success', content: '昵称修改成功' });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '修改失败' });
    }
  };

  const handleEditTel = async () => {
    const currentValue = user?.user_tel || '';

    const result = await Dialog.confirm({
      title: '修改手机号',
      content: (
        <Input
          id="tel-input"
          placeholder="请输入手机号"
          defaultValue={currentValue}
          maxLength={20}
          type="tel"
          style={{ '--font-size': '16px' }}
        />
      ),
    });

    if (!result) return;

    const input = document.getElementById('tel-input') as HTMLInputElement;
    const newTel = input?.value?.trim();

    try {
      await userApi.updateProfile({ tel: newTel });
      updateUser({ user_tel: newTel });
      Toast.show({ icon: 'success', content: '手机号修改成功' });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '修改失败' });
    }
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
              border: '1px solid var(--app-color-border)',
              borderRadius: 'var(--app-radius-s)',
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
              border: '1px solid var(--app-color-border)',
              borderRadius: 'var(--app-radius-s)',
            }}
          />
        </div>
      ),
    });

    if (!result) return;

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
  };

  const handleLogout = () => {
    Dialog.confirm({
      content: '确定要退出登录吗？',
      onConfirm: () => {
        logout();
        window.location.href = '/login';
      },
    });
  };

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>我的资料</HeaderTitle>
      </Header>

      <Section>
        <ProfileRow onClick={handleAvatarClick}>
          <RowLabel>头像</RowLabel>
          <RowValue>
            <AvatarWrapper>
              <Avatar $avatar={avatarUrl}>
                {!avatarUrl && (user?.user_nickname?.charAt(0).toUpperCase() || 'U')}
              </Avatar>
            </AvatarWrapper>
          </RowValue>
          <RowArrow>›</RowArrow>
        </ProfileRow>
        <HiddenInput
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
        <ProfileRow>
          <RowLabel>登录名</RowLabel>
          <RowValue>{user?.user_login_name}</RowValue>
        </ProfileRow>
        <ProfileRow onClick={handleEditNickname}>
          <RowLabel>昵称</RowLabel>
          <RowValue>{user?.user_nickname || '未设置'}</RowValue>
          <RowArrow>›</RowArrow>
        </ProfileRow>
        <ProfileRow onClick={handleEditTel}>
          <RowLabel>手机号</RowLabel>
          <RowValue>{user?.user_tel || '未设置'}</RowValue>
          <RowArrow>›</RowArrow>
        </ProfileRow>
        <ProfileRow>
          <RowLabel>注册时间</RowLabel>
          <RowValue>{user?.user_create_time ? new Date(Number(user.user_create_time)).toLocaleDateString('zh-CN') : '未知'}</RowValue>
        </ProfileRow>
        <ProfileRow onClick={handleChangePassword}>
          <RowLabel>修改密码</RowLabel>
          <RowValue></RowValue>
          <RowArrow>›</RowArrow>
        </ProfileRow>
      </Section>

      <LogoutButton onClick={handleLogout}>
        退出登录
      </LogoutButton>

      {/* Avatar Crop Popup */}
      <Popup
        visible={cropPopupVisible}
        onMaskClick={() => setCropPopupVisible(false)}
        bodyStyle={{ height: 'auto' }}
      >
        <CropContainer>
          {imageSrc && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                style={{ maxHeight: '50vh', maxWidth: '100%' }}
                onLoad={onImageLoad}
              />
            </ReactCrop>
          )}
          <CropActions>
            <CropButton onClick={() => setCropPopupVisible(false)}>
              取消
            </CropButton>
            <CropButton $primary onClick={handleCropConfirm}>
              确定
            </CropButton>
          </CropActions>
        </CropContainer>
      </Popup>
    </Container>
  );
}