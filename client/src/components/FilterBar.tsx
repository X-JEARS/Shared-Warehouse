import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { RightOutline } from 'antd-mobile-icons';
import { boxApi, tagApi } from '../services/api';

const BoxTabBar = styled.div`
  position: relative;
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
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  padding: 10px 0 8px;
  border: 0;
  background: transparent;
  color: ${(props) => (props.$active ? 'var(--app-color-primary)' : 'var(--app-color-text-weak)')};
  font: inherit;
  font-size: 14px;
  font-weight: ${(props) => (props.$active ? 500 : 400)};
  white-space: nowrap;
  cursor: pointer;
`;

const BoxTabIndicator = styled.div<{ $left: number; $width: number; $visible: boolean; $animated: boolean }>`
  position: absolute;
  bottom: 0;
  left: ${(props) => props.$left}px;
  width: ${(props) => props.$width}px;
  height: 2px;
  border-radius: 1px;
  background: var(--app-color-primary);
  opacity: ${(props) => (props.$visible ? 1 : 0)};
  transition: ${(props) => (props.$animated ? 'left 0.24s cubic-bezier(0.22, 0.61, 0.36, 1), width 0.24s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none')};
  pointer-events: none;
`;

const TagBubble = styled.button<{ $active?: boolean }>`
  position: fixed;
  left: 16px;
  bottom: calc(50px + env(safe-area-inset-bottom, 0px) + 16px);
  z-index: 100;
  max-width: min(54vw, 240px);
  height: 36px;
  min-width: 64px;
  padding: 0 ${(props) => (props.$active ? '14px' : '6px')} 0 14px;
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

const TagBubbleIcon = styled(RightOutline)`
  flex: 0 0 auto;
  margin-left: 3px;
  font-size: 13px;
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

const ClearTagFilterButton = styled.button`
  flex: 0 0 auto;
  height: 36px;
  margin: 0 0 calc(16px + env(safe-area-inset-bottom, 0px));
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-color-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;

  &:active {
    opacity: 0.7;
  }
`;

interface FilterBarProps {
  roomId: number | undefined;
  selectedBox?: number | 'out-of-stock';
  selectedTag?: number;
  onFilterChange: (filters: { boxId?: number | 'out-of-stock'; tagId?: number }) => void;
  onBoxesChange?: (boxes: Box[]) => void;
  swipeProgress?: {
    fromIndex: number;
    toIndex: number;
    progress: number;
  };
  swipeAnimating?: boolean;
}

interface Box {
  box_id: number;
  box_name: string;
}

interface Tag {
  tag_id: number;
  tag_name: string;
}

export default function FilterBar({
  roomId,
  selectedBox,
  selectedTag,
  onFilterChange,
  onBoxesChange,
  swipeProgress,
  swipeAnimating = false,
}: FilterBarProps) {
  const { t } = useTranslation();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagDrawerVisible, setTagDrawerVisible] = useState(false);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false });

  const boxFilterIds = [undefined, 'out-of-stock', ...boxes.map((box) => box.box_id)] as Array<number | 'out-of-stock' | undefined>;
  const clampBoxIndex = (index: number) => Math.max(0, Math.min(boxFilterIds.length - 1, index));
  const selectedBoxIndex = clampBoxIndex(boxFilterIds.findIndex((boxId) => boxId === selectedBox));
  const visualSelectedBoxIndex = swipeProgress && swipeProgress.progress >= 0.999
    ? clampBoxIndex(swipeProgress.toIndex)
    : selectedBoxIndex;

  useEffect(() => {
    setTagDrawerVisible(false);
    setBoxes([]);
    onBoxesChange?.([]);
    onFilterChange({});

    if (roomId) {
      loadFilters(roomId);
    } else {
      setTags([]);
    }
  }, [roomId]);

  useLayoutEffect(() => {
    const tabBar = tabBarRef.current;
    if (!tabBar || boxFilterIds.length === 0) {
      setIndicator((current) => current.visible ? { left: 0, width: 0, visible: false } : current);
      return;
    }

    const fromIndex = clampBoxIndex(swipeProgress?.fromIndex ?? selectedBoxIndex);
    const toIndex = clampBoxIndex(swipeProgress?.toIndex ?? fromIndex);
    const progress = Math.max(0, Math.min(1, swipeProgress?.progress ?? 0));
    const fromTab = tabRefs.current[fromIndex];
    const toTab = tabRefs.current[toIndex] || fromTab;

    if (!fromTab || !toTab) {
      setIndicator((current) => current.visible ? { left: 0, width: 0, visible: false } : current);
      return;
    }

    const left = fromTab.offsetLeft + (toTab.offsetLeft - fromTab.offsetLeft) * progress;
    const width = fromTab.offsetWidth + (toTab.offsetWidth - fromTab.offsetWidth) * progress;
    const nextIndicator = { left, width, visible: true };
    setIndicator((current) => (
      current.visible === nextIndicator.visible
      && Math.abs(current.left - nextIndicator.left) < 0.5
      && Math.abs(current.width - nextIndicator.width) < 0.5
        ? current
        : nextIndicator
    ));

    const desiredScrollLeft = Math.max(
      0,
      Math.min(
        tabBar.scrollWidth - tabBar.clientWidth,
        left + width / 2 - tabBar.clientWidth / 2
      )
    );
    if (Math.abs(tabBar.scrollLeft - desiredScrollLeft) > 1) {
      tabBar.scrollLeft = desiredScrollLeft;
    }
  });

  useEffect(() => {
    const handleResize = () => {
      setIndicator((current) => ({ ...current }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadFilters = async (targetRoomId: number) => {
    try {
      const [boxRes, tagRes]: any[] = await Promise.all([
        boxApi.getByRoom(targetRoomId),
        tagApi.getByRoom(targetRoomId),
      ]);
      setBoxes(boxRes.data || []);
      setTags(tagRes.data || []);
      onBoxesChange?.(boxRes.data || []);
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  };

  const handleBoxChange = (boxId: number | 'out-of-stock' | undefined) => {
    onFilterChange({ boxId, tagId: selectedTag });
  };

  const handleTagChange = (tagId: number | undefined) => {
    setTagDrawerVisible(false);
    onFilterChange({ boxId: selectedBox, tagId });
  };

  return (
    <>
      <BoxTabBar ref={tabBarRef} role="tablist" aria-label={t('filterBar.boxes')}>
        <BoxTab
          ref={(node) => {
            tabRefs.current[0] = node;
          }}
          type="button"
          role="tab"
          aria-selected={visualSelectedBoxIndex === 0}
          $active={visualSelectedBoxIndex === 0}
          onClick={() => handleBoxChange(undefined)}
        >
          {t('filterBar.all')}
        </BoxTab>
        <BoxTab
          ref={(node) => {
            tabRefs.current[1] = node;
          }}
          type="button"
          role="tab"
          aria-selected={visualSelectedBoxIndex === 1}
          $active={visualSelectedBoxIndex === 1}
          onClick={() => handleBoxChange('out-of-stock')}
        >
          {t('filterBar.notInStock')}
        </BoxTab>
        {boxes.map((box, index) => (
          <BoxTab
            key={box.box_id}
            ref={(node) => {
              tabRefs.current[index + 2] = node;
            }}
            type="button"
            role="tab"
            aria-selected={visualSelectedBoxIndex === index + 2}
            $active={visualSelectedBoxIndex === index + 2}
            onClick={() => handleBoxChange(box.box_id)}
          >
            {box.box_name || t('filterBar.boxId', { id: box.box_id })}
          </BoxTab>
        ))}
        <BoxTabIndicator
          $left={indicator.left}
          $width={indicator.width}
          $visible={indicator.visible}
          $animated={swipeAnimating || !swipeProgress}
        />
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
        {selectedTag === undefined && <TagBubbleIcon aria-hidden="true" />}
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
          {selectedTag !== undefined && (
            <ClearTagFilterButton type="button" onClick={() => handleTagChange(undefined)}>
              {t('filterBar.clearTagFilter')}
            </ClearTagFilterButton>
          )}
        </TagDrawer>
      </TagDrawerLayer>
    </>
  );
}
