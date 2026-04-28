import { useEffect, useState, useRef, useCallback } from 'react';
import { SearchBar, SpinLoading, Input, Button, Toast, Popup, Dialog, ActionSheet } from 'antd-mobile';
import styled from 'styled-components';
import { itemApi, scanApi, userApi } from '../services/api';
import Scanner from '../components/Scanner';
import ReactCrop from 'react-image-crop';
import { makeAspectCrop, Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  background: white;
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
`;

const BackButton = styled.span`
  font-size: 20px;
  cursor: pointer;
  margin-right: 12px;
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
`;

const SearchContainer = styled.div`
  padding: 12px 16px;
  background: white;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
`;

const ItemCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const ItemRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ItemImage = styled.div<{ $image?: string }>`
  width: 60px;
  height: 60px;
  border-radius: 8px;
  background: ${(props) =>
    props.$image ? `url(${props.$image}) center/cover` : '#f0f0f0'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
`;

const ItemInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemName = styled.div`
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ItemMeta = styled.div`
  font-size: 13px;
  color: #666;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ActionButton = styled.span`
  color: #1677ff;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
`;

const LocationTag = styled.span`
  display: inline-block;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #e6f4ff;
  color: #1677ff;
  margin-left: 4px;
`;

const EmptyContainer = styled.div`
  text-align: center;
  padding: 40px 20px;
`;

const EmptyText = styled.p`
  color: #999;
`;

const PopupContent = styled.div`
  padding: 20px;
`;

const PopupTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
`;

const PopupButtons = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
`;

const ScannerPopupContent = styled.div`
  padding: 20px;
`;

const ConfirmInfo = styled.div`
  background: #f5f5f5;
  padding: 12px;
  border-radius: 8px;
  margin: 16px 0;
`;

const ConfirmRow = styled.div`
  display: flex;
  margin-bottom: 8px;
  &:last-child {
    margin-bottom: 0;
  }
`;

const ConfirmLabel = styled.span`
  color: #666;
  width: 80px;
  flex-shrink: 0;
`;

const ConfirmValue = styled.span`
  color: #333;
`;

const ImageOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  opacity: 0;
  transition: opacity 0.2s;
`;

const ImageWrapper = styled.div`
  position: relative;
  cursor: pointer;

  &:hover ${ImageOverlay} {
    opacity: 1;
  }
`;

const HiddenInput = styled.input`
  display: none;
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

const UserSearchContainer = styled.div`
  margin-bottom: 16px;
`;

const UserList = styled.div`
  max-height: 300px;
  overflow-y: auto;
`;

const UserItem = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  background: ${(props) => (props.$selected ? '#e6f4ff' : 'transparent')};
  transition: background 0.2s;

  &:hover {
    background: #f5f5f5;
  }
`;

const UserAvatar = styled.div<{ $avatar?: string }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${(props) =>
    props.$avatar ? `url(${props.$avatar}) center/cover` : '#e0e0e0'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
`;

const UserInfo = styled.div`
  flex: 1;
`;

const UserNickname = styled.div`
  font-size: 14px;
  font-weight: 500;
`;

const NoUsers = styled.div`
  text-align: center;
  padding: 20px;
  color: #999;
`;

interface MyItem {
  item_id: number;
  item_name: string;
  item_image?: string;
  item_create_time: number;
  current_box_name?: string;
  current_room_name?: string;
  belong_box_name?: string;
  belong_room_name?: string;
  belong_box_id?: number;
  belong_room_id?: number;
  display_location_name?: string;
}

interface BoxInfo {
  box_id: number;
  box_name: string;
  box_belong_room_id: number;
  room_name: string;
}

interface SearchedUser {
  user_id: number;
  user_nickname: string;
  user_avatar?: string;
}

export default function MyItems() {
  const [items, setItems] = useState<MyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [changingBelongBoxItem, setChangingBelongBoxItem] = useState<MyItem | null>(null);
  const [scannedBoxInfo, setScannedBoxInfo] = useState<BoxInfo | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  // Image upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageCropPopupVisible, setImageCropPopupVisible] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [uploadingItem, setUploadingItem] = useState<MyItem | null>(null);

  // Transfer states
  const [transferPopupVisible, setTransferPopupVisible] = useState(false);
  const [transferItem, setTransferItem] = useState<MyItem | null>(null);
  const [userSearchKeyword, setUserSearchKeyword] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);
  const [searchingUsers, setSearchingUsers] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const res: any = await itemApi.getMy();
      setItems(res.data || []);
    } catch (error) {
      console.error('Failed to load my items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Image upload handlers
  const handleImageClick = (item: MyItem) => {
    setUploadingItem(item);
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
      setImageCropPopupVisible(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const newCrop = makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      1,
      width,
      height,
    );
    setCrop(newCrop);
    setCompletedCrop(undefined);
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
            const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
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
      if (!uploadingItem) return;

      const croppedFile = await getCroppedImg();
      if (!croppedFile) {
        Toast.show({ icon: 'fail', content: '请先选择裁剪区域' });
        return;
      }

      const formData = new FormData();
      formData.append('image', croppedFile);

      const res: any = await itemApi.uploadImage(uploadingItem.item_id, formData);
      const newImagePath = res.data.image;

      // Update local state
      setItems(items.map(item =>
        item.item_id === uploadingItem.item_id
          ? { ...item, item_image: `${newImagePath}?t=${Date.now()}` }
          : item
      ));

      Toast.show({ icon: 'success', content: '图片更新成功' });
      setImageCropPopupVisible(false);
      setImageSrc(null);
      setUploadingItem(null);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '更新失败' });
    }
  };

  const showActionSheet = (item: MyItem) => {
    const handler = ActionSheet.show({
      actions: [
        { text: '编辑名称', key: 'edit' },
        { text: '转让', key: 'transfer' },
        { text: '删除', key: 'delete', danger: true },
      ],
      cancelText: '取消',
      onAction: (action) => {
        handler.close();
        if (action.key === 'edit') {
          handleEditName(item);
        } else if (action.key === 'transfer') {
          handleTransfer(item);
        } else if (action.key === 'delete') {
          handleDelete(item);
        }
      },
    });
  };

  const handleEditName = (item: MyItem) => {
    let currentEditName = item.item_name;
    Dialog.confirm({
      content: (
        <div>
          <div style={{ marginBottom: 12, fontWeight: 500 }}>修改物品名称</div>
          <Input
            defaultValue={item.item_name}
            onChange={(value) => { currentEditName = value; }}
            placeholder="请输入物品名称"
            style={{ '--text-align': 'left' }}
          />
        </div>
      ),
      confirmText: '保存',
      cancelText: '取消',
      onConfirm: async () => {
        if (!currentEditName.trim()) {
          Toast.show({ content: '物品名称不能为空' });
          return;
        }
        try {
          await itemApi.update(item.item_id, { name: currentEditName });
          setItems(items.map(i =>
            i.item_id === item.item_id
              ? { ...i, item_name: currentEditName }
              : i
          ));
          Toast.show({ icon: 'success', content: '名称已更新' });
        } catch (error) {
          Toast.show({ icon: 'fail', content: '更新失败' });
        }
      },
    });
  };

  const handleTransfer = (item: MyItem) => {
    setTransferItem(item);
    setUserSearchKeyword('');
    setSearchedUsers([]);
    setSelectedUser(null);
    setTransferPopupVisible(true);
  };

  const searchUsers = async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchedUsers([]);
      return;
    }

    try {
      setSearchingUsers(true);
      const res: any = await userApi.search(keyword);
      setSearchedUsers(res.data || []);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '搜索失败' });
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!transferItem || !selectedUser) {
      Toast.show({ content: '请选择要转让的用户' });
      return;
    }

    try {
      await itemApi.transfer(transferItem.item_id, selectedUser.user_id);
      // 从列表中移除已转让的物品
      setItems(items.filter(item => item.item_id !== transferItem.item_id));
      setTransferPopupVisible(false);
      Toast.show({ icon: 'success', content: `物品已转让给 ${selectedUser.user_nickname}` });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '转让失败' });
    }
  };

  const handleDelete = async (item: MyItem) => {
    const confirmed = await Dialog.confirm({
      content: `确定要删除「${item.item_name}」吗？删除后将无法恢复，该物品的所有记录（历史、评论、预约等）都将被删除。`,
      confirmText: <span style={{ color: '#ff4d4f' }}>删除</span>,
      cancelText: '取消',
    });

    if (confirmed) {
      try {
        await itemApi.delete(item.item_id);
        setItems(items.filter(i => i.item_id !== item.item_id));
        Toast.show({ icon: 'success', content: '物品已删除' });
      } catch (error: any) {
        Toast.show({ icon: 'fail', content: error.message || '删除失败' });
      }
    }
  };

  const handleChangeBelongBox = (item: MyItem) => {
    setChangingBelongBoxItem(item);
    setScannerVisible(true);
  };

  const handleScan = async (scannedText: string): Promise<boolean> => {
    // 验证是盒子二维码
    if (!scannedText.startsWith('box.')) {
      Toast.show({ content: '请扫描盒子二维码' });
      return false; // 继续扫描
    }

    try {
      // 通过扫描 API 获取盒子信息
      const res: any = await scanApi.scan(scannedText);

      if (res.data?.type !== 'box') {
        Toast.show({ content: '未找到该盒子' });
        return false;
      }

      const box = res.data.box;

      // 检查盒子是否是个人盒子（box_belong_room_id 为 null 表示是个人盒子）
      if (!box.box_belong_room_id) {
        Toast.show({ content: '不能将物品归属到个人盒子' });
        return false;
      }

      setScannedBoxInfo({
        box_id: box.box_id,
        box_name: box.box_name,
        box_belong_room_id: box.box_belong_room_id,
        room_name: box.room_name
      });
      setScannerVisible(false);
      setConfirmVisible(true);
      return true; // 停止扫描
    } catch (error: any) {
      console.error('Scan box error:', error);
      Toast.show({ content: error.message || '扫码失败' });
      return false;
    }
  };

  const handleConfirmChange = async () => {
    if (!changingBelongBoxItem || !scannedBoxInfo) return;

    try {
      await itemApi.changeBelongBox(changingBelongBoxItem.item_id, scannedBoxInfo.box_id);

      // 更新本地数据
      setItems(items.map(item =>
        item.item_id === changingBelongBoxItem.item_id
          ? {
              ...item,
              belong_box_id: scannedBoxInfo.box_id,
              belong_box_name: scannedBoxInfo.box_name,
              belong_room_id: scannedBoxInfo.box_belong_room_id,
              belong_room_name: scannedBoxInfo.room_name
            }
          : item
      ));

      setConfirmVisible(false);
      setScannedBoxInfo(null);
      setChangingBelongBoxItem(null);
      Toast.show({ icon: 'success', content: '归属盒子已更新' });
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '更新失败' });
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchText) return true;
    const text = searchText.toLowerCase();
    return item.item_name?.toLowerCase().includes(text);
  });

  if (loading) {
    return (
      <Container>
        <Header>
          <HeaderTitle>我的物品</HeaderTitle>
        </Header>
        <Content>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <SpinLoading />
          </div>
        </Content>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <BackButton onClick={() => window.history.back()}>
          ←
        </BackButton>
        <HeaderTitle>我的物品</HeaderTitle>
      </Header>

      <SearchContainer>
        <SearchBar
          value={searchText}
          onChange={setSearchText}
          placeholder="搜索物品..."
          showCancelButton
        />
      </SearchContainer>

      <Content>
        {filteredItems.length === 0 ? (
          <EmptyContainer>
            <EmptyText>
              {searchText ? '没有找到匹配的物品' : '暂无物品'}
            </EmptyText>
          </EmptyContainer>
        ) : (
          filteredItems.map((item) => (
            <ItemCard key={item.item_id}>
              <ItemRow>
                <ImageWrapper onClick={() => handleImageClick(item)}>
                  <ItemImage $image={item.item_image}>
                    {!item.item_image && '📦'}
                  </ItemImage>
                  <ImageOverlay>📷</ImageOverlay>
                </ImageWrapper>
                <ItemInfo>
                  <ItemName>
                    {item.item_name}
                    <ActionButton onClick={() => showActionSheet(item)}>
                      操作
                    </ActionButton>
                  </ItemName>
                  <ItemMeta>
                    所在位置:
                    <LocationTag>
                      {item.display_location_name || item.current_room_name || '未知'}
                    </LocationTag>
                    {item.current_box_name && ` / ${item.current_box_name}`}
                  </ItemMeta>
                  <ItemMeta>
                    应归还到: {item.belong_room_name || '未知仓库'}
                    {item.belong_box_name && ` / ${item.belong_box_name}`}
                    <ActionButton onClick={() => handleChangeBelongBox(item)}>
                      变更
                    </ActionButton>
                  </ItemMeta>
                </ItemInfo>
              </ItemRow>
            </ItemCard>
          ))
        )}
      </Content>

      <Popup
        visible={scannerVisible}
        onMaskClick={() => {
          setScannerVisible(false);
          setChangingBelongBoxItem(null);
        }}
        bodyStyle={{ borderRadius: '12px 12px 0 0' }}
      >
        <ScannerPopupContent>
          <PopupTitle>扫描新归属盒子</PopupTitle>
          <Scanner
            showStopButton
            onScan={handleScan}
            onError={(e) => console.error('Scanner error:', e)}
          />
        </ScannerPopupContent>
      </Popup>

      <Popup
        visible={confirmVisible}
        onMaskClick={() => {
          setConfirmVisible(false);
          setScannedBoxInfo(null);
          setChangingBelongBoxItem(null);
        }}
        bodyStyle={{ borderRadius: '12px 12px 0 0' }}
      >
        <PopupContent>
          <PopupTitle>确认变更归属盒子</PopupTitle>
          <ConfirmInfo>
            <ConfirmRow>
              <ConfirmLabel>物品名称:</ConfirmLabel>
              <ConfirmValue>{changingBelongBoxItem?.item_name}</ConfirmValue>
            </ConfirmRow>
            <ConfirmRow>
              <ConfirmLabel>新归属盒子:</ConfirmLabel>
              <ConfirmValue>{scannedBoxInfo?.box_name}</ConfirmValue>
            </ConfirmRow>
            <ConfirmRow>
              <ConfirmLabel>所属仓库:</ConfirmLabel>
              <ConfirmValue>{scannedBoxInfo?.room_name}</ConfirmValue>
            </ConfirmRow>
          </ConfirmInfo>
          <PopupButtons>
            <Button color="primary" size="small" onClick={handleConfirmChange}>
              确认变更
            </Button>
            <Button size="small" onClick={() => {
              setConfirmVisible(false);
              setScannedBoxInfo(null);
              setChangingBelongBoxItem(null);
            }}>
              取消
            </Button>
          </PopupButtons>
        </PopupContent>
      </Popup>

      {/* Transfer Popup */}
      <Popup
        visible={transferPopupVisible}
        onMaskClick={() => setTransferPopupVisible(false)}
        bodyStyle={{ borderRadius: '12px 12px 0 0' }}
      >
        <PopupContent>
          <PopupTitle>转让物品「{transferItem?.item_name}」</PopupTitle>
          <UserSearchContainer>
            <SearchBar
              value={userSearchKeyword}
              onChange={(value) => {
                setUserSearchKeyword(value);
                searchUsers(value);
              }}
              placeholder="搜索用户昵称..."
            />
          </UserSearchContainer>
          {searchingUsers ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <SpinLoading />
            </div>
          ) : searchedUsers.length > 0 ? (
            <UserList>
              {searchedUsers.map((user) => (
                <UserItem
                  key={user.user_id}
                  $selected={selectedUser?.user_id === user.user_id}
                  onClick={() => setSelectedUser(user)}
                >
                  <UserAvatar $avatar={user.user_avatar}>
                    {!user.user_avatar && '👤'}
                  </UserAvatar>
                  <UserInfo>
                    <UserNickname>{user.user_nickname}</UserNickname>
                  </UserInfo>
                  {selectedUser?.user_id === user.user_id && (
                    <span style={{ color: '#1677ff' }}>✓</span>
                  )}
                </UserItem>
              ))}
            </UserList>
          ) : userSearchKeyword ? (
            <NoUsers>未找到匹配的用户</NoUsers>
          ) : (
            <NoUsers>请输入用户昵称搜索</NoUsers>
          )}
          <PopupButtons>
            <Button
              color="primary"
              size="small"
              onClick={handleConfirmTransfer}
              disabled={!selectedUser}
            >
              确认转让
            </Button>
            <Button size="small" onClick={() => setTransferPopupVisible(false)}>
              取消
            </Button>
          </PopupButtons>
        </PopupContent>
      </Popup>

      {/* Hidden file input for image upload */}
      <HiddenInput
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />

      {/* Image Crop Popup */}
      <Popup
        visible={imageCropPopupVisible}
        onMaskClick={() => {
          setImageCropPopupVisible(false);
          setImageSrc(null);
          setUploadingItem(null);
        }}
        bodyStyle={{ height: 'auto' }}
      >
        <CropContainer>
          {imageSrc && (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
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
            <CropButton onClick={() => {
              setImageCropPopupVisible(false);
              setImageSrc(null);
              setUploadingItem(null);
            }}>
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
