import { Alert, Empty, Skeleton } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MetaList } from '../components/data-display';
import { DetailShell } from '../components/layout';
import { SectionCard } from '../components/ui';
import { fetchOrderDetail, getApiErrorMessage, type OrderDetail } from '../services/api';
import { resolveProductGallery } from '../utils/productCover';

export function OrderSnapshotPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    async function load() {
      if (!Number.isFinite(orderId) || orderId <= 0) {
        setError('缺少有效订单编号。');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await fetchOrderDetail(orderId);
        setDetail(result);
        setActiveImage(0);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, '商品快照加载失败。'));
        setDetail(null);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [orderId]);

  const detailImages = useMemo(() => {
    if (!detail) {
      return [];
    }

    return resolveProductGallery({
      title: detail.orderSnapshot.title,
      category: detail.orderSnapshot.category,
      price: detail.orderSnapshot.price,
      sellerName: detail.orderSnapshot.sellerName ?? '卖家',
      imageUrl: detail.orderSnapshot.imageUrl ?? undefined
    }, detail.orderSnapshot.productId, 6);
  }, [detail]);

  const currentImage = detailImages[activeImage] ?? detailImages[0] ?? detail?.orderSnapshot.imageUrl ?? '';
  const snapshotMeta = useMemo(() => {
    if (!detail) {
      return [];
    }

    return [
      detail.orderSnapshot.category,
      detail.orderSnapshot.condition,
      detail.orderSnapshot.sellerName || '未知卖家'
    ];
  }, [detail]);

  if (loading) {
    return <Skeleton active paragraph={{ rows: 14 }} />;
  }

  if (!detail) {
    return (
      <div className="page-grid">
        {error ? <Alert type="error" showIcon message={error} /> : null}
        <SectionCard>
          <Empty description="未找到商品快照" />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="detail-page order-snapshot-detail-page">
      {error ? <Alert type="error" showIcon message={error} /> : null}

      <DetailShell
        mainMedia={(
          <div className="detail-main-layout-product">
            <div className="detail-thumb-column">
              {detailImages.map((image, index) => (
                <button
                  key={`${detail.orderSnapshot.productId}-${index}`}
                  type="button"
                  className={index === activeImage ? 'detail-thumb active' : 'detail-thumb'}
                  onClick={() => setActiveImage(index)}
                >
                  <img src={image} alt={`${detail.orderSnapshot.title}-${index + 1}`} />
                </button>
              ))}
            </div>

            <div className="detail-main-photo-shell">
              <img
                className="detail-main-photo"
                src={currentImage}
                alt={detail.orderSnapshot.title}
              />
            </div>
          </div>
        )}
        sidePanel={(
          <div className="detail-info-panel order-snapshot-info-panel">
            <div className="detail-info-top">
              <div className="detail-price-block">
                <div className="listing-detail-amount">
                  <strong>¥{detail.orderSnapshot.price.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            <div className="detail-info-body">
              <h1 className="detail-main-title">{detail.orderSnapshot.title}</h1>
              <MetaList items={snapshotMeta} className="detail-seller-strip-meta order-snapshot-meta" />
              <div className="detail-description-block">
                <p>{detail.orderSnapshot.description || '暂无描述'}</p>
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
}
