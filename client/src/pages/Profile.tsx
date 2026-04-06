import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Toast, Popup, Input } from 'antd-mobile';
import {
  InformationCircleOutline,
} from 'antd-mobile-icons';
import ReactCrop from 'react-image-crop';
import { makeAspectCrop, Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
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

const AvatarWrapper = styled.div`
  position: relative;
  display: inline-block;
  cursor: pointer;
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

const AvatarOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  opacity: 0;
  transition: opacity 0.2s;

  ${AvatarWrapper}:hover & {
    opacity: 1;
  }
`;

const NicknameRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
`;

const Nickname = styled.span`
  font-size: 18px;
  font-weight: 600;
  color: #333;
  text-align: center;
`;

const EditIconButton = styled.button`
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #1677ff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;

  &:hover {
    opacity: 0.8;
  }
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

const LogoutButton = styled.button`
  margin: 24px 16px;
  width: calc(100% - 32px);
  padding: 12px;
  border: 1px solid #ff4d4f;
  border-radius: 8px;
  background: transparent;
  color: #ff4d4f;
  font-size: 16px;
  cursor: pointer;
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
  border: ${(props) => (props.$primary ? 'none' : '1px solid #ddd')};
  border-radius: 8px;
  background: ${(props) => (props.$primary ? '#1677ff' : 'white')};
  color: ${(props) => (props.$primary ? 'white' : '#333')};
  font-size: 16px;
  cursor: pointer;
`;

const HiddenInput = styled.input`
  display: none;
`;

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
): Crop {
  return makeAspectCrop(
    {
      unit: '%',
      width: 90,
    },
    1,
    mediaWidth,
    mediaHeight,
  );
}

// Edit Icon SVG component
function EditIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropPopupVisible, setCropPopupVisible] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now());
  const imgRef = useRef<HTMLImageElement>(null);

  // Get avatar URL with timestamp to avoid cache
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
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const newCrop = centerAspectCrop(width, height);
    setCrop(newCrop);
    setCompletedCrop(undefined);
  };

  const getCroppedImg = useCallback(async (): Promise<File | null> => {
    if (!imgRef.current || !completedCrop) return null;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');

    // Target size for compression (200x200 is good for avatar)
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

    // Convert canvas to Blob
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
      setAvatarTimestamp(Date.now()); // Force refresh avatar
      Toast.show({ icon: 'success', content: '头像更新成功' });
      setCropPopupVisible(false);
      setImageSrc(null);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '更新失败' });
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

  const handleEditNickname = () => {
    const currentValue = user?.user_nickname || '';

    Dialog.show({
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
      closeOnMaskClick: true,
      actions: [
        {
          key: 'cancel',
          text: '取消',
        },
        {
          key: 'confirm',
          text: '确定',
          bold: true,
          onClick: async () => {
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
          },
        },
      ],
    });
  };

  const handleMyItems = () => {
    window.location.href = '/my-items';
  };

  return (
    <Container>
      <Header>
        <AvatarWrapper onClick={handleAvatarClick}>
          <Avatar $avatar={avatarUrl}>
            {!avatarUrl && (user?.user_nickname?.charAt(0).toUpperCase() || 'U')}
          </Avatar>
          <AvatarOverlay>📷</AvatarOverlay>
        </AvatarWrapper>
        <HiddenInput
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
        <NicknameRow>
          <Nickname>{user?.user_nickname || '未设置昵称'}</Nickname>
          <EditIconButton onClick={handleEditNickname}>
            <EditIcon size={18} />
          </EditIconButton>
        </NicknameRow>
        <LoginName>@{user?.user_login_name}</LoginName>
      </Header>

      <Section>
        <MenuItem icon="📦" text="我的物品" onClick={handleMyItems} showBorder />
        <MenuItem icon="📋" text="我的预约" onClick={() => navigate('/my-reservations')} showBorder />
        <MenuItem icon="🔒" text="修改密码" onClick={handleChangePassword} />
      </Section>

      <Section>
        <MenuItem
          icon={<InformationCircleOutline fontSize={18} />}
          text="关于"
          onClick={() =>
            Dialog.alert({
              title: '关于',
              content: '共享仓库 v1.0.0\n扫码借还，高效管理',
            })
          }
        />
      </Section>

      <LogoutButton onClick={handleLogout}>
        🚪 退出登录
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
              onChange={(c) => setCrop(c)}
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

// Menu Item component
function MenuItem({
  icon,
  text,
  onClick,
  showBorder = false,
}: {
  icon: React.ReactNode | string;
  text: string;
  onClick: () => void;
  showBorder?: boolean;
}) {
  return (
    <div
      style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        borderBottom: showBorder ? '1px solid #f0f0f0' : 'none',
      }}
      onClick={onClick}
    >
      {typeof icon === 'string' ? (
        <span style={{ fontSize: 18, marginRight: 12 }}>{icon}</span>
      ) : (
        <span style={{ marginRight: 12 }}>{icon}</span>
      )}
      <span>{text}</span>
    </div>
  );
}
