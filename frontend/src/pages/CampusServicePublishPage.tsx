import { CampusServicePublishWorkbench } from '../components/publish';

export function CampusServicePublishPage() {
  return (
    <div className="page-grid campus-service-page">
      <section className="page-topbar service-market-topbar">
        <div className="page-topbar-copy">
          <h1>发布校园服务</h1>
        </div>
      </section>

      <CampusServicePublishWorkbench />
    </div>
  );
}
