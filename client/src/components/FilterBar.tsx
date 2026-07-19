import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { boxApi, tagApi } from '../services/api';

const BoxTabBar = styled.div`
  background: var(--app-color-surface);
  display: flex;
  gap: 20px;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-color-border);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const BoxTab = styled.button<{ $active?: boolean }>`
  flex: 0 0 auto;
  padding: 10px 0 8px;
  border: 0;
  background: transparent;
  color: ${(props) => (props.$active ? 'var(--app-color-primary)' : 'var(--app-color-text-weak)')};
  font: inherit;
  font-size: 14px;
  font-weight: ${(props) => (props.$active ? 500 : 400)};
  white-space: nowrap;
  position: relative;
  cursor: pointer;

  &::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 2px;
    border-radius: 1px;
    background: ${(props) => (props.$active ? 'var(--app-color-primary)' : 'transparent')};
  }
`;

const TagBubble = styled.button<{ $active?: boolean }>`
  position: fixed;
  left: 16px;
  bottom: calc(50px + env(safe-area-inset-bottom, 0px) + 16px);
  z-index: 100;
  max-width: min(54vw, 240px);
  height: 36px;
  min-width: 64px;
  padding: 0 14px;
  border: 1px solid ${(props) => (props.$active ? 'var(--app-color-primary)' : 'var(--app-color-border)')};
  border-radius: var(--app-radius-pill);
  background: ${(props) => (props.$active ? 'var(--app-color-primary)' : 'var(--app-color-surface)')};
  color: ${(props) => (props.$active ? 'var(--app-color-white)' : 'var(--app-color-text)')};
  display: flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: var(--app-shadow-fab);
  cursor: pointer;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.95);
  }

  @media (min-width: 768px) {
    left: 72px;
    bottom: 16px;
  }
`;

const TagBubbleLabel = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TagDrawerLayer = styled.div<{ $visible: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 200;
  visibility: ${(props) => (props.$visible ? 'visible' : 'hidden')};
  pointer-events: ${(props) => (props.$visible ? 'auto' : 'none')};
  transition: visibility 0s linear ${(props) => (props.$visible ? '0s' : '0.2s')};
`;

const TagDrawerMask = styled.button<{ $visible: boolean }>`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: var(--app-color-overlay);
  opacity: ${(props) => (props.$visible ? 1 : 0)};
  cursor: default;
  transition: opacity 0.2s;
`;

const TagDrawer = styled.div<{ $visible: boolean }>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: min(37vw, 140px);
  display: flex;
  flex-direction: column;
  background: var(--app-color-surface);
  box-shadow: var(--app-shadow-tab);
  transform: translateX(${(props) => (props.$visible ? '0' : '-100%')});
  transition: transform 0.2s;
`;

const TagList = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  padding: 8px 0 max(16px, env(safe-area-inset-bottom, 0px));
`;

const TagItem = styled.button<{ $active?: boolean }>`
  width: 100%;
  min-height: 48px;
  padding: 12px 18px 12px 15px;
  border: 0;
  border-left: 3px solid ${(props) => (props.$active ? 'var(--app-color-primary)' : 'transparent')};
  background: ${(props) => (props.$active ? 'var(--app-color-info-bg)' : 'transparent')};
  color: ${(props) => (props.$active ? 'var(--app-color-primary)' : 'var(--app-color-text)')};
  font: inherit;
  font-size: 14px;
  font-weight: ${(props) => (props.$active ? 500 : 400)};
  line-height: 20px;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;

  &:active {
    background: var(--app-color-hover);
  }
`;

const EmptyTags = styled.div`
  padding: 24px 18px;
  color: var(--app-color-text-secondary);
  font-size: 14px;
  text-align: center;
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
  const { t } = useTranslation();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedBox, setSelectedBox] = useState<number | 'out-of-stock' | undefined>();
  const [selectedTag, setSelectedTag] = useState<number | undefined>();
  const [tagDrawerVisible, setTagDrawerVisible] = useState(false);

  useEffect(() => {
    setSelectedBox(undefined);
    setSelectedTag(undefined);
    setTagDrawerVisible(false);
    onFilterChange({});

    if (roomId) {
      loadFilters(roomId);
    } else {
      setBoxes([]);
      setTags([]);
    }
  }, [roomId]);

  const loadFilters = async (targetRoomId: number) => {
    try {
      const [boxRes, tagRes]: any[] = await Promise.all([
        boxApi.getByRoom(targetRoomId),
        tagApi.getByRoom(targetRoomId),
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
    setTagDrawerVisible(false);
    onFilterChange({ boxId: selectedBox, tagId });
  };

  return (
    <>
      <BoxTabBar role="tablist" aria-label={t('filterBar.boxes')}>
        <BoxTab
          type="button"
          role="tab"
          aria-selected={selectedBox === undefined}
          $active={selectedBox === undefined}
          onClick={() => handleBoxChange(undefined)}
        >
          {t('filterBar.all')}
        </BoxTab>
        <BoxTab
          type="button"
          role="tab"
          aria-selected={selectedBox === 'out-of-stock'}
          $active={selectedBox === 'out-of-stock'}
          onClick={() => handleBoxChange('out-of-stock')}
        >
          {t('filterBar.notInStock')}
        </BoxTab>
        {boxes.map((box) => (
          <BoxTab
            key={box.box_id}
            type="button"
            role="tab"
            aria-selected={selectedBox === box.box_id}
            $active={selectedBox === box.box_id}
            onClick={() => handleBoxChange(box.box_id)}
          >
            {box.box_name || t('filterBar.boxId', { id: box.box_id })}
          </BoxTab>
        ))}
      </BoxTabBar>

      <TagBubble
        type="button"
        $active={selectedTag !== undefined}
        aria-label={t('filterBar.openTags')}
        title={t('filterBar.openTags')}
        onClick={() => setTagDrawerVisible(true)}
      >
        <TagBubbleLabel>
          {selectedTag
            ? tags.find((tag) => tag.tag_id === selectedTag)?.tag_name || t('filterBar.tags')
            : t('filterBar.tags')}
        </TagBubbleLabel>
      </TagBubble>

      <TagDrawerLayer $visible={tagDrawerVisible} aria-hidden={!tagDrawerVisible}>
        <TagDrawerMask
          type="button"
          $visible={tagDrawerVisible}
          aria-label={t('filterBar.closeTags')}
          tabIndex={tagDrawerVisible ? 0 : -1}
          onClick={() => setTagDrawerVisible(false)}
        />
        <TagDrawer $visible={tagDrawerVisible} role="dialog" aria-modal="true" aria-label={t('filterBar.tags')}>
          <TagList role="listbox" aria-label={t('filterBar.tags')}>
            <TagItem
              type="button"
              role="option"
              aria-selected={selectedTag === undefined}
              $active={selectedTag === undefined}
              onClick={() => handleTagChange(undefined)}
            >
              {t('filterBar.all')}
            </TagItem>
            {tags.map((tag) => (
              <TagItem
                key={tag.tag_id}
                type="button"
                role="option"
                aria-selected={selectedTag === tag.tag_id}
                $active={selectedTag === tag.tag_id}
                onClick={() => handleTagChange(tag.tag_id)}
              >
                {tag.tag_name}
              </TagItem>
            ))}
            {tags.length === 0 && <EmptyTags>{t('filterBar.noTags')}</EmptyTags>}
          </TagList>
        </TagDrawer>
      </TagDrawerLayer>
    </>
  );
}
