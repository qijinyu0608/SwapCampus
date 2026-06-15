import { useParams } from 'react-router-dom';
import { CampusServicePublishWorkbench } from '../components/publish';

export function CampusServicePublishPage() {
  const { id } = useParams();
  const isEditMode = Boolean(id);

  return (
    <div className="page-grid campus-service-page">
      <section className="page-topbar service-market-topbar">
        <div className="page-topbar-copy">
          <h1>{isEditMode ? '编辑校园服务' : '发布校园服务'}</h1>
        </div>
      </section>

      <CampusServicePublishWorkbench listingId={id ? Number(id) : undefined} />
    </div>
  );
}
