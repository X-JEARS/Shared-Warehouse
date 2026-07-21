import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Empty, InfiniteScroll } from 'antd-mobile';
import { ListSkeleton } from '../components/skeleton';
import { useMinLoadingTime } from '../hooks/useMinLoadingTime';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { transferRecordApi } from '../services/api';

const BORROW_TYPE = 1;
const RETURN_TYPE = 2;

interface TransferItem {
  history_id: number;
  history_item_id: number;
  item_name: string;
  item_image?: string | null;
  box_name?: string | null;
  holder_nickname?: string | null;
}

interface TransferRecord {
  transfer_record_id: number;
  transfer_record_type: number;
  transfer_record_time: number | string;
  transfer_record_image?: string | null;
  items: TransferItem[];
}

const Container = styled.div`
  min-height: 100%;
  background: var(--app-color-bg);
`;

const Header = styled.div`
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--app-color-surface);
  padding: 8px 16px;
  border-bottom: 1px solid var(--app-color-border);
  display: flex;
  align-items: center;
`;

const BackButton = styled.span`
  font-size: 20px;
  cursor: pointer;
  margin-right: 12px;
  color: var(--app-color-text);
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: var(--app-color-text);
`;

const Content = styled.div`
  padding: 12px;
`;

const RecordCard = styled.div`
  margin-bottom: 12px;
  padding: 14px;
  border-radius: var(--app-radius-m);
  background: var(--app-color-surface);
  box-shadow: var(--app-shadow-card);
`;

const RecordHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const RecordMeta = styled.div`
  min-width: 0;
`;

const TypeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TypeBadge = styled.span<{ $type: number }>`
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: var(--app-radius-s);
  background: ${({ $type }) => $type === BORROW_TYPE
    ? 'var(--app-color-warning-bg)'
    : 'var(--app-color-success-bg)'};
  color: ${({ $type }) => $type === BORROW_TYPE
    ? 'var(--app-color-warning-text)'
    : 'var(--app-color-success)'};
  font-size: 13px;
  font-weight: 500;
`;

const ItemCount = styled.span`
  color: var(--app-color-text-secondary);
  font-size: 13px;
`;

const RecordTime = styled.div`
  margin-top: 6px;
  color: var(--app-color-text-secondary);
  font-size: 12px;
`;

const RecordPhoto = styled.img`
  width: 80px;
  height: 60px;
  border-radius: var(--app-radius-s);
  object-fit: cover;
  flex-shrink: 0;
  cursor: pointer;
`;

const ItemList = styled.div`
  margin-top: 12px;
  border-top: 1px solid var(--app-color-border);
`;

const ItemRow = styled.div`
  min-height: 54px;
  padding: 8px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--app-color-border);

  &:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }
`;

const ItemImage = styled.div<{ $image?: string | null }>`
  width: 38px;
  height: 38px;
  border-radius: var(--app-radius-s);
  background: ${({ $image }) => $image
    ? `url(${$image}) center/cover`
    : 'var(--app-color-avatar-default)'};
  color: var(--app-color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
`;

const ItemInfo = styled.div`
  min-width: 0;
  flex: 1;
`;

const ItemName = styled.div`
  color: var(--app-color-text);
  font-size: 14px;
  word-break: break-word;
`;

const ItemLocation = styled.div`
  margin-top: 3px;
  color: var(--app-color-text-secondary);
  font-size: 12px;
  word-break: break-word;
`;

const EmptyItems = styled.div`
  padding-top: 12px;
  color: var(--app-color-text-secondary);
  font-size: 13px;
`;

const CenterState = styled.div`
  min-height: 240px;
  padding: 60px 24px;
  text-align: center;
`;

const ImageViewer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--app-color-overlay-heavy);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  cursor: pointer;
`;

const ViewerImage = styled.img`
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
`;

export default function MyTransferRecords() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  const loadFirstPage = async () => {
    try {
      setInitialLoading(true);
      setLoadError(false);
      const res: any = await transferRecordApi.getAll(1, 20);
      const data = res.data;
      setRecords(data?.items || []);
      setNextPage(2);
      setHasMore((data?.page || 1) < (data?.totalPages || 0));
    } catch (err) {
      console.error('Failed to load transfer records:', err);
      setLoadError(true);
      setHasMore(false);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadFirstPage();
  }, []);

  const loadMore = async () => {
    try {
      const res: any = await transferRecordApi.getAll(nextPage, 20);
      const data = res.data;
      setRecords((current) => [...current, ...(data?.items || [])]);
      setNextPage((page) => page + 1);
      setHasMore((data?.page || nextPage) < (data?.totalPages || 0));
    } catch (err) {
      console.error('Failed to load more transfer records:', err);
      setHasMore(false);
    }
  };

  const formatTime = (timestamp: number | string) => {
    const value = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
    if (!value || Number.isNaN(value)) return t('common.unknownTime');
    return new Date(value).toLocaleString(i18n.language === 'en-US' ? 'en-US' : 'zh-CN');
  };

  const getLocation = (record: TransferRecord, item: TransferItem) => {
    if (record.transfer_record_type === BORROW_TYPE) {
      return item.holder_nickname || t('myTransferRecords.inHand');
    }
    return item.box_name || t('common.unknown');
  };

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>{t('myTransferRecords.title')}</HeaderTitle>
      </Header>

      {useMinLoadingTime(initialLoading) ? (
        <CenterState>
          <div style={{ padding: 16 }}>
            <ListSkeleton count={6} />
          </div>
        </CenterState>
      ) : loadError ? (
        <CenterState>
          <Empty description={t('myTransferRecords.loadFailed')} />
          <Button size="small" color="primary" onClick={loadFirstPage}>
            {t('common.retry')}
          </Button>
        </CenterState>
      ) : records.length === 0 ? (
        <CenterState>
          <Empty description={t('myTransferRecords.empty')} />
        </CenterState>
      ) : (
        <Content>
          {records.map((record) => (
            <RecordCard key={record.transfer_record_id}>
              <RecordHeader>
                <RecordMeta>
                  <TypeRow>
                    <TypeBadge $type={record.transfer_record_type}>
                      {record.transfer_record_type === RETURN_TYPE
                        ? t('myTransferRecords.return')
                        : t('myTransferRecords.borrow')}
                    </TypeBadge>
                    <ItemCount>
                      {t('myTransferRecords.itemCount', { count: record.items.length })}
                    </ItemCount>
                  </TypeRow>
                  <RecordTime>{formatTime(record.transfer_record_time)}</RecordTime>
                </RecordMeta>
                {record.transfer_record_image && (
                  <RecordPhoto
                    src={record.transfer_record_image}
                    alt={t('myTransferRecords.photo')}
                    onClick={() => setViewerImage(record.transfer_record_image || null)}
                  />
                )}
              </RecordHeader>

              {record.items.length > 0 ? (
                <ItemList>
                  {record.items.map((item) => (
                    <ItemRow key={item.history_id}>
                      <ItemImage $image={item.item_image}>
                        {!item.item_image && item.item_name?.charAt(0).toUpperCase()}
                      </ItemImage>
                      <ItemInfo>
                        <ItemName>{item.item_name}</ItemName>
                        <ItemLocation>
                          {t('myTransferRecords.destination', { location: getLocation(record, item) })}
                        </ItemLocation>
                      </ItemInfo>
                    </ItemRow>
                  ))}
                </ItemList>
              ) : (
                <EmptyItems>{t('myTransferRecords.noItems')}</EmptyItems>
              )}
            </RecordCard>
          ))}
          <InfiniteScroll loadMore={loadMore} hasMore={hasMore} />
        </Content>
      )}

      {viewerImage && (
        <ImageViewer onClick={() => setViewerImage(null)}>
          <ViewerImage src={viewerImage} alt={t('myTransferRecords.photo')} />
        </ImageViewer>
      )}
    </Container>
  );
}
