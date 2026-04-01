import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Form, Input, Button, TextArea, Toast, Selector, Dialog } from 'antd-mobile';
import styled from 'styled-components';
import { itemApi, boxApi, tagApi } from '../services/api';
import { useRoomStore } from '../stores/roomStore';
import Scanner from '../components/Scanner';

const Container = styled.div`
  min-height: 100%;
  background: #f5f5f5;
`;

const Content = styled.div`
  padding: 16px;
`;

const WarningBox = styled.div`
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  text-align: center;
`;

const WarningTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: #d46b08;
  margin-bottom: 8px;
`;

const WarningText = styled.div`
  font-size: 14px;
  color: #873800;
  margin-bottom: 12px;
`;

const ScanModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f5f5f5;
  z-index: 1000;
`;

export default function CreateItem() {
  const navigate = useNavigate();
  const { currentRoom } = useRoomStore();
  const [loading, setLoading] = useState(false);
  const [boxes, setBoxes] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loadingBoxes, setLoadingBoxes] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [formData, setFormData] = useState({
    qrcode: '',
    name: '',
    boxId: '',
    tagIds: [] as number[],
    notice: '',
  });

  // 加载盒子和标签列表
  useEffect(() => {
    if (currentRoom) {
      setLoadingBoxes(true);
      Promise.all([
        boxApi.getByRoom(currentRoom.room_id),
        tagApi.getByRoom(currentRoom.room_id),
      ])
        .then(([boxesRes, tagsRes]: any[]) => {
          setBoxes(boxesRes.data || []);
          setTags(tagsRes.data || []);
          // 默认选择第一个盒子
          if (boxesRes.data?.length > 0) {
            setFormData(prev => ({
              ...prev,
              boxId: boxesRes.data[0].box_id.toString(),
            }));
          }
        })
        .catch((err) => {
          console.error('Failed to load data:', err);
        })
        .finally(() => {
          setLoadingBoxes(false);
        });
    }
  }, [currentRoom]);

  const handleScanQrcode = (qrcode: string): boolean => {
    // 验证二维码不能是box.开头
    if (qrcode.startsWith('box.')) {
      Toast.show({ icon: 'fail', content: '物品二维码不能是盒子二维码' });
      // 返回 false 继续扫描
      return false;
    }
    setFormData({ ...formData, qrcode });
    setShowScanner(false);
    return true;
  };

  const handleSubmit = async () => {
    if (!formData.qrcode || !formData.name || !formData.boxId) {
      Toast.show({ content: '请填写必填项' });
      return;
    }

    // 再次验证二维码
    if (formData.qrcode.startsWith('box.')) {
      Toast.show({ icon: 'fail', content: '物品二维码不能是盒子二维码' });
      return;
    }

    try {
      setLoading(true);
      // 创建物品
      const res: any = await itemApi.create({
        qrcode: formData.qrcode,
        name: formData.name,
        boxId: parseInt(formData.boxId),
        notice: formData.notice || undefined,
      });

      // 如果选择了标签，设置标签
      if (formData.tagIds.length > 0 && currentRoom) {
        try {
          await itemApi.setTags(res.data.item_id, currentRoom.room_id, formData.tagIds);
        } catch (tagError) {
          console.error('Failed to set tags:', tagError);
          // 标签设置失败不影响物品创建成功
        }
      }

      Toast.show({ icon: 'success', content: '创建成功' });
      navigate(-1);
    } catch (error: any) {
      Toast.show({ icon: 'fail', content: error.message || '创建失败' });
    } finally {
      setLoading(false);
    }
  };

  // 没有选择仓库
  if (!currentRoom) {
    return (
      <Container>
        <NavBar onBack={() => navigate(-1)}>添加物品</NavBar>
        <Content>
          <WarningBox>
            <WarningTitle>请先选择仓库</WarningTitle>
            <WarningText>您需要先选择一个仓库才能添加物品</WarningText>
            <Button color="primary" onClick={() => navigate('/warehouse')}>
              返回仓库
            </Button>
          </WarningBox>
        </Content>
      </Container>
    );
  }

  // 加载中
  if (loadingBoxes) {
    return (
      <Container>
        <NavBar onBack={() => navigate(-1)}>添加物品</NavBar>
        <Content style={{ textAlign: 'center', paddingTop: 40 }}>
          加载中...
        </Content>
      </Container>
    );
  }

  // 没有盒子
  if (boxes.length === 0) {
    return (
      <Container>
        <NavBar onBack={() => navigate(-1)}>添加物品</NavBar>
        <Content>
          <WarningBox>
            <WarningTitle>当前仓库没有盒子</WarningTitle>
            <WarningText>
              物品需要存放在盒子中，请先在仓库设置中添加至少一个盒子
            </WarningText>
            <Button
              color="primary"
              onClick={() => navigate(`/room-settings/${currentRoom.room_id}`)}
            >
              前往添加盒子
            </Button>
          </WarningBox>
        </Content>
      </Container>
    );
  }

  return (
    <Container>
      <NavBar onBack={() => navigate(-1)}>添加物品</NavBar>

      <Content>
        <Form layout="horizontal">
          <Form.Item label="二维码" required>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                value={formData.qrcode}
                onChange={(v) => setFormData({ ...formData, qrcode: v })}
                placeholder="请扫描物品二维码"
                style={{ flex: 1 }}
              />
              <Button
                size="small"
                color="primary"
                onClick={() => setShowScanner(true)}
              >
                扫码
              </Button>
            </div>
          </Form.Item>

          <Form.Item label="物品名称" required>
            <Input
              value={formData.name}
              onChange={(v) => setFormData({ ...formData, name: v })}
              placeholder="请输入物品名称"
              maxLength={24}
            />
          </Form.Item>

          <Form.Item label="存放位置" required>
            <Selector
              options={boxes.map((b) => ({
                label: b.box_name || `盒子 ${b.box_id}`,
                value: b.box_id.toString(),
              }))}
              value={formData.boxId ? [formData.boxId] : []}
              onChange={(arr) => setFormData({ ...formData, boxId: arr[0] || '' })}
              style={{ '--gap': '8px' }}
            />
          </Form.Item>

          {tags.length > 0 && (
            <Form.Item label="标签">
              <Selector
                options={tags.map((t) => ({
                  label: t.tag_name,
                  value: t.tag_id.toString(),
                }))}
                value={formData.tagIds.map(String)}
                onChange={(arr) =>
                  setFormData({
                    ...formData,
                    tagIds: arr.map(Number),
                  })
                }
                multiple
                style={{ '--gap': '8px' }}
              />
            </Form.Item>
          )}

          <Form.Item label="备注名">
            <TextArea
              value={formData.notice}
              onChange={(v) => setFormData({ ...formData, notice: v })}
              placeholder="物品备注名（可选）"
              maxLength={120}
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
          创建物品
        </Button>
      </Content>

      {/* 扫码弹窗 */}
      {showScanner && (
        <ScanModal>
          <NavBar onBack={() => setShowScanner(false)}>扫描物品二维码</NavBar>
          <Content>
            <Scanner
              onScan={handleScanQrcode}
              onError={(error) => {
                console.error('Scanner error:', error);
                Toast.show({ icon: 'fail', content: '扫描失败' });
              }}
            />
          </Content>
        </ScanModal>
      )}
    </Container>
  );
}
