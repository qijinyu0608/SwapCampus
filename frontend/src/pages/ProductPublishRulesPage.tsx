import { Skeleton } from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublishRulesDocument, resolvePublishingRulesDocumentProps } from '../components/product';
import { fetchPublishingRules, type PublishingRules } from '../services/api';

export function ProductPublishRulesPage() {
  const [rules, setRules] = useState<PublishingRules | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublishingRules()
      .then(setRules)
      .catch(() => setRules(null))
      .finally(() => setLoading(false));
  }, []);

  const documentProps = resolvePublishingRulesDocumentProps(rules);

  return (
    <div className="page-grid publish-rules-page">
      <div className="publish-rules-page-topbar">
        <Link className="publish-rules-anchor" to="/publish">返回发布页</Link>
      </div>

      <section className="publish-rules-page-body">
        {!loading ? <h1 style={{ marginBottom: 16 }}>SwapCampus 发布规则</h1> : null}
        {loading ? <Skeleton active paragraph={{ rows: 12 }} /> : <PublishRulesDocument {...documentProps} />}
      </section>
    </div>
  );
}
