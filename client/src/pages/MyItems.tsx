import { useEffect, useState } from 'react';
import { SearchBar, SpinLoading, Input, Button, Toast, Popup } from 'antd-mobile';
import styled from 'styled-components';
import { itemApi } from '../services/api';

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
`;

const EditButton = styled.span`
  color: #1677ff;
  cursor: pointer;
  font-size: 13px;
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

interface MyItem {
  item_id: number;
  item_name: string;
  item_image?: string;
  item_create_time: number;
  current_box_name?: string;
  current_room_name?: string;
  belong_box_name?: string;
  belong_room_name?: string;
  display_location_name?: string;
}

export default function MyItems() {
  const [items, setItems] = useState<MyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [editingItem, setEditingItem] = useState<MyItem | null>(null);
  const [editName, setEditName] = useState('');
  const [popupVisible, setPopupVisible] = useState(false);

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

  const handleEdit = (item: MyItem) => {
    setEditingItem(item);
    setEditName(item.item_name);
    setPopupVisible(true);
  };

  const handleSaveName = async () => {
    if (!editingItem || !editName.trim()) {
      Toast.show({ content: '物品名称不能为空' });
      return;
    }
    try {
      await itemApi.update(editingItem.item_id, { name: editName });
      setItems(items.map(item =>
        item.item_id === editingItem.item_id
          ? { ...item, item_name: editName }
          : item
      ));
      setPopupVisible(false);
      Toast.show({ icon: 'success', content: '名称已更新' });
    } catch (error) {
      Toast.show({ icon: 'fail', content: '更新失败' });
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
                <ItemImage $image={item.item_image}>
                  {!item.item_image && '📦'}
                </ItemImage>
                <ItemInfo>
                  <ItemName>
                    {item.item_name}
                    <EditButton onClick={() => handleEdit(item)}>
                      编辑
                    </EditButton>
                  </ItemName>
                  <ItemMeta>
                    所在位置:
                    <LocationTag>
                      {item.display_location_name || item.current_room_name || '未知'}
                    </LocationTag>
                    {item.current_box_name && ` / ${item.current_box_name}`}
                  </ItemMeta>
                  <ItemMeta>
                    归属: {item.belong_room_name || '未知仓库'}
                    {item.belong_box_name && ` / ${item.belong_box_name}`}
                  </ItemMeta>
                </ItemInfo>
              </ItemRow>
            </ItemCard>
          ))
        )}
      </Content>

      <Popup
        visible={popupVisible}
        onMaskClick={() => setPopupVisible(false)}
        bodyStyle={{ borderRadius: '12px 12px 0 0' }}
      >
        <PopupContent>
          <PopupTitle>修改物品名称</PopupTitle>
          <Input
            value={editName}
            onChange={setEditName}
            placeholder="请输入物品名称"
          />
          <PopupButtons>
            <Button color="primary" size="small" onClick={handleSaveName}>
              保存
            </Button>
            <Button size="small" onClick={() => setPopupVisible(false)}>
              取消
            </Button>
          </PopupButtons>
        </PopupContent>
      </Popup>
    </Container>
  );
}
