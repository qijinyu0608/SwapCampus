import { Alert, Button, Form, Input, InputNumber, Select } from 'antd';
import { useEffect, useState } from 'react';
import { InfoList, TagList } from '../components/data-display';
import { FoldSection } from '../components/disclosure';
import { ActionRow, InlineMeta, PageCard } from '../components/layout';
import { createProduct, fetchPublishingRules, getApiErrorMessage, PublishingRules } from '../services/api';
import { getDemoUser, hasTradingAccess, isGuestUser } from '../services/session';

const descriptionTemplates = [
  {
    key: 'student',
    title: '学生自用版',
    content: '之前自己用的，现在用不上了所以出了。东西没啥问题，正常使用，具体成色看图。可以校内面交，图书馆、学一食堂、学研中心A座附近都方便。诚心要的话可以小刀。'
  },
  {
    key: 'graduate',
    title: '毕业清仓版',
    content: '毕业清东西所以出掉，自用闲置，功能正常。放着也用不到了，低价转给有需要的同学。成色看图，有正常使用痕迹，校内自提或面交都可以。'
  },
  {
    key: 'dorm',
    title: '搬宿舍版',
    content: '搬宿舍清闲置，买来之后用过一段时间，现在不太需要了。东西正常，没有影响使用的问题，细节都在图里。13号公寓、学二食堂、东门附近都能面交，价格可以小刀。'
  },
  {
    key: 'digital',
    title: '数码验货版',
    content: '学生自用，功能都正常，平时主要拿来上课、记笔记、看网课。外观有正常使用痕迹，具体看图，配件如图，有需要可以当面验货。校内面交优先。'
  },
  {
    key: 'book',
    title: '教材资料版',
    content: '这学期用完了，现在用不上了。内容完整，可能会有少量笔记和划线，不影响继续使用，复习的时候反而能参考。校内面交方便，省得走邮寄。'
  },
  {
    key: 'cheap',
    title: '低价回血版',
    content: '闲置回血，不是二道贩子。功能正常，成色如图，价格已经按二手价放低了。诚心要的话可以小刀，校内面交优先。'
  }
] as const;

const defaultAllowedCategories = ['教材', '数码', '生活用品', '运动器材', '宿舍好物', '自行车', '文具', '小家电', '鞋服', '考研资料'];
const defaultDormElectricalWhitelist = ['电脑', '非充电台灯', '手机', '平板电脑', '20000mAh以下充电宝', '电动牙刷', '电动剃须刀', '相机'];
const defaultCommunityNotices = [
  '宿舍电器只允许白名单内物品发布，吹风机、电热饭盒、热水壶等会被系统直接驳回。',
  '交易优先选择图书馆、食堂、公寓楼下等校内公共区域，建议当面验货后再确认。',
  '商品标题和描述请写清成色、配件、容量或版本，避免同学误判。'
];
const defaultRuleHighlights = [
  '禁售词命中直接驳回',
  '白名单外宿舍电器禁止发布',
  '充电宝需标明容量且不超过 20000mAh',
  '通过后仍保留人工巡检'
];

function buildPublishTags(values: {
  title: string;
  category: string;
  condition: string;
  tags?: string;
}) {
  const normalizedTags = (values.tags ?? '')
    .split(/[，,、/\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  const fallbackTitle = values.title.trim().slice(0, 12);
  const combinedTags = [
    ...normalizedTags,
    values.category,
    values.condition,
    fallbackTitle
  ].filter(Boolean);

  return combinedTags.filter((tag, index) => combinedTags.indexOf(tag) === index).slice(0, 4).join(',');
}

export function ProductPublishPage() {
  const [form] = Form.useForm();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rules, setRules] = useState<PublishingRules | null>(null);
  const allowedCategories = rules?.allowedCategories ?? defaultAllowedCategories;
  const dormElectricalWhitelist = rules?.dormElectricalWhitelist ?? defaultDormElectricalWhitelist;
  const communityNotices = rules?.communityNotices ?? defaultCommunityNotices;
  const ruleHighlights = rules?.ruleHighlights ?? defaultRuleHighlights;
  const categoryTagItems = allowedCategories.map((item) => ({ key: item, label: item }));
  const whitelistTagItems = dormElectricalWhitelist.map((item) => ({ key: item, label: item, tone: 'success' as const }));
  const reviewInfoItems = [
    {
      key: 'prohibited',
      title: '禁售词',
      detail: (rules?.prohibitedKeywords ?? ['刀具', '代抢', '账号']).slice(0, 5).join(' / ')
    },
    {
      key: 'review-flow',
      title: '审核流',
      detail: (rules?.reviewFlow ?? ['实名认证', '内容校验', '人工审核']).join(' · ')
    }
  ];

  useEffect(() => {
    fetchPublishingRules().then(setRules).catch(() => setRules(null));
  }, []);

  async function handleSubmit(values: {
    title: string;
    category: string;
    price: number;
    condition: string;
    description: string;
    tags?: string;
  }) {
    const demoUser = getDemoUser();
    if (!hasTradingAccess(demoUser)) {
      setMessage({ type: 'error', text: isGuestUser(demoUser) ? '浏览账号不可发布商品。' : '请先登录后再发布商品。' });
      return;
    }

    const activeUser = demoUser;
    if (!activeUser) {
      return;
    }

    const finalTags = buildPublishTags(values);

    try {
      const result = await createProduct({
        title: values.title,
        description: values.description,
        price: values.price,
        category: values.category,
        condition: values.condition,
        tags: finalTags
      });

      setMessage({ type: 'success', text: `商品已提交：${result.title}（ID ${result.id}，状态 ${result.status}）` });
      form.resetFields();
    } catch (error) {
      setMessage({
        type: 'error',
        text: getApiErrorMessage(error, '发布失败，请稍后重试。')
      });
    }
  }

  function applyTemplate(content: string) {
    form.setFieldValue('description', content);
  }

  return (
    <div className="page-grid publish-page">
      <section className="page-topbar">
        <div className="page-topbar-copy">
          <h1>发布商品</h1>
          <span>同校转手</span>
        </div>
        <div className="page-topbar-tags">
          <span>校内面交</span>
        </div>
      </section>

      <div className="publish-layout">
        <PageCard>
          {message ? <Alert style={{ marginBottom: 16 }} type={message.type} showIcon message={message.text} /> : null}
          <Form form={form} layout="vertical" onFinish={handleSubmit} className="form-shell publish-form">
            <div className="publish-form-section publish-form-section-main">
              <Form.Item name="title" label="商品标题" rules={[{ required: true }]}>
                <Input placeholder="例如：九成新计算机网络教材" />
              </Form.Item>
              <Form.Item name="category" label="分类" rules={[{ required: true }]}>
                <Select options={allowedCategories.map((item) => ({ value: item }))} />
              </Form.Item>
              <div className="publish-form-inline">
                <Form.Item name="price" label="价格" rules={[{ required: true }]}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="condition" label="成色" rules={[{ required: true }]}>
                  <Select options={[{ value: '95新' }, { value: '9成新' }, { value: '8成新' }]} />
                </Form.Item>
              </div>
              <Form.Item name="description" label="描述" rules={[{ required: true }]}>
                <Input.TextArea rows={4} placeholder="使用情况、配件、交易地点" />
              </Form.Item>
            </div>
            <FoldSection title="补充信息" meta="标签 / 写法 / 规则" compact>
              <div className="publish-form-section">
                <Form.Item name="tags" label="标签">
                  <Input placeholder="例如：教材,考试周；不填会自动生成" />
                </Form.Item>
              </div>
            </FoldSection>
            <ActionRow className="publish-submit-row" leading={<InlineMeta>默认按校内面交发布</InlineMeta>}>
              <Button type="primary" htmlType="submit">发布</Button>
            </ActionRow>
          </Form>
        </PageCard>

        <div className="page-grid publish-side-stack">
          <PageCard>
            <FoldSection title="常用写法" meta={`${descriptionTemplates.length} 条`} compact>
              <div className="publish-template-list">
                {descriptionTemplates.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="publish-template-card"
                    onClick={() => applyTemplate(item.content)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.content}</span>
                  </button>
                ))}
              </div>
            </FoldSection>
          </PageCard>

          <PageCard>
            <FoldSection title="发布提示" meta="4 条" compact>
              <div className="publish-summary-list">
                <div>
                  <strong>自动审核</strong>
                  <span>禁售词和违规宿舍电器会直接驳回</span>
                </div>
                <div>
                  <strong>电器白名单</strong>
                  <span>只发布手册允许的宿舍电器</span>
                </div>
                <div>
                  <strong>容量表达</strong>
                  <span>充电宝请写明 mAh 容量</span>
                </div>
                <div>
                  <strong>成交习惯</strong>
                  <span>面交地点写明白</span>
                </div>
              </div>
            </FoldSection>
          </PageCard>

          <PageCard>
            <FoldSection title="规则" meta={`${allowedCategories.length} 类`} compact>
              <TagList items={categoryTagItems} />
              <div className="publish-rule-block">
                <strong>社区公告</strong>
                <div className="publish-notice-list">
                  {communityNotices.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
              <div className="publish-rule-block">
                <strong>宿舍电器白名单</strong>
                <TagList items={whitelistTagItems} compact />
              </div>
              <div className="publish-rule-block">
                <strong>审核说明</strong>
                <div className="publish-rule-points">
                  {ruleHighlights.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
              <InfoList className="compact-list" items={reviewInfoItems} />
            </FoldSection>
          </PageCard>
        </div>
      </div>
    </div>
  );
}
