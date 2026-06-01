import { useEffect, useState } from 'react';
import { Dropdown, Tag } from 'antd-mobile';
import styled from 'styled-components';
import { boxApi, tagApi } from '../services/api';

const FilterContainer = styled.div`
  padding: 2px 8px;
  background: var(--app-color-surface);
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid var(--app-color-border);
`;

const FilterItem = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: var(--app-color-bg);
  border-radius: var(--app-radius-s);
  font-size: 12px;
  cursor: pointer;
`;

interface FilterBarProps {
  roomId: number | undefined;
  onFilterChange: (filters: { boxId?: number | 'out-of-stock'; tagId?: number }) => void;
}

interface Box {
  box_id: number;
  box_name: string;
}

interface Tag {
  tag_id: number;
  tag_name: string;
}

export default function FilterBar({ roomId, onFilterChange }: FilterBarProps) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedBox, setSelectedBox] = useState<number | 'out-of-stock' | undefined>();
  const [selectedTag, setSelectedTag] = useState<number | undefined>();

  useEffect(() => {
    if (roomId) {
      loadFilters();
    }
  }, [roomId]);

  const loadFilters = async () => {
    try {
      const [boxRes, tagRes]: any[] = await Promise.all([
        boxApi.getByRoom(roomId!),
        tagApi.getByRoom(roomId!),
      ]);
      setBoxes(boxRes.data || []);
      setTags(tagRes.data || []);
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  };

  const handleBoxChange = (boxId: number | 'out-of-stock' | undefined) => {
    setSelectedBox(boxId);
    onFilterChange({ boxId, tagId: selectedTag });
  };

  const handleTagChange = (tagId: number | undefined) => {
    setSelectedTag(tagId);
    onFilterChange({ boxId: selectedBox, tagId });
  };

  const clearFilters = () => {
    setSelectedBox(undefined);
    setSelectedTag(undefined);
    onFilterChange({});
  };

  return (
    <FilterContainer>
      <Dropdown>
        <Dropdown.Item
          key="box"
          title={
            <FilterItem>
              {selectedBox === 'out-of-stock'
                ? '不在库中'
                : selectedBox
                  ? boxes.find((b) => b.box_id === selectedBox)?.box_name || '盒子'
                  : '全部'}
            </FilterItem>
          }
        >
          <div style={{ padding: '12px' }}>
            <div
              onClick={() => handleBoxChange(undefined)}
              style={{ padding: '12px 0', color: !selectedBox ? 'var(--app-color-primary)' : undefined }}
            >
              全部
            </div>
            <div
              onClick={() => handleBoxChange('out-of-stock')}
              style={{
                padding: '12px 0',
                borderTop: '1px solid var(--app-color-border)',
                color: selectedBox === 'out-of-stock' ? 'var(--app-color-primary)' : undefined,
              }}
            >
              不在库中
            </div>
            {boxes.map((box) => (
              <div
                key={box.box_id}
                onClick={() => handleBoxChange(box.box_id)}
                style={{
                  padding: '12px 0',
                  borderTop: '1px solid var(--app-color-border)',
                  color: selectedBox === box.box_id ? 'var(--app-color-primary)' : undefined,
                }}
              >
                {box.box_name || `盒子 ${box.box_id}`}
              </div>
            ))}
          </div>
        </Dropdown.Item>
      </Dropdown>

      <Dropdown>
        <Dropdown.Item
          key="tag"
          title={
            <FilterItem>
              {selectedTag
                ? tags.find((t) => t.tag_id === selectedTag)?.tag_name || '标签'
                : '标签'}
            </FilterItem>
          }
        >
          <div style={{ padding: '12px' }}>
            <div
              onClick={() => handleTagChange(undefined)}
              style={{ padding: '12px 0', color: !selectedTag ? 'var(--app-color-primary)' : undefined }}
            >
              全部
            </div>
            {tags.map((tag) => (
              <div
                key={tag.tag_id}
                onClick={() => handleTagChange(tag.tag_id)}
                style={{
                  padding: '12px 0',
                  borderTop: '1px solid var(--app-color-border)',
                  color: selectedTag === tag.tag_id ? 'var(--app-color-primary)' : undefined,
                }}
              >
                {tag.tag_name}
              </div>
            ))}
          </div>
        </Dropdown.Item>
      </Dropdown>

      {(selectedBox || selectedTag) && (
        <FilterItem onClick={clearFilters} style={{ flex: '0 0 auto', padding: '8px 12px', whiteSpace: 'nowrap' }}>
          清除
        </FilterItem>
      )}
    </FilterContainer>
  );
}