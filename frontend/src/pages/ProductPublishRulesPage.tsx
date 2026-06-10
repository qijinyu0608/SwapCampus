import { Skeleton } from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, SectionHeader } from '../components/layout';
import { PublishRulesDocument, resolvePublishingRulesDocumentProps } from '../components/product';
import { SectionCard } from '../components/ui';
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
      <PageHeader
        title="商品发布规则"
        subtitle="以下内容为发布行为适用的正式规则文本。"
        meta={<Link className="publish-rules-anchor" to="/publish">返回发布页</Link>}
      />

      <SectionCard
        className="publish-rules-page-card"
        title={<SectionHeader title="商品发布规则" description="提交商品前请完整阅读并遵守以下规则。" />}
      >
        {loading ? <Skeleton active paragraph={{ rows: 12 }} /> : <PublishRulesDocument {...documentProps} />}
      </SectionCard>
    </div>
  );
}
