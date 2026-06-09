import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Select
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionRow, PageCard, SectionHeader } from '../components/layout';
import { useAuthState } from '../services/auth-state';
import {
  createCampusServiceTask,
  type CampusServiceCategory,
  type CampusServiceContactPreference,
  type CampusServiceFulfillmentMode,
  type CampusServiceUrgency,
  getApiErrorMessage
} from '../services/api';
import { bjfuLocationSections, bjfuServiceRoutePresets } from '../constants/campus';
import { hasTradingAccess, isGuestUser } from '../services/session';

const moduleConfig: Array<{
  key: CampusServiceCategory;
  title: string;
}> = [
  { key: 'ERRAND', title: '校园跑腿' },
  { key: 'AGENCY', title: '代办代取' },
  { key: 'GROUP_BUY', title: '校内拼单' },
  { key: 'HELP', title: '临时帮忙' }
] as const;

const urgencyOptions: Array<{ value: CampusServiceUrgency; label: string }> = [
  { value: 'NORMAL', label: '普通' },
  { value: 'TODAY', label: '今日内' },
  { value: 'URGENT', label: '加急' }
];

const fulfillmentModeOptions: Array<{ value: CampusServiceFulfillmentMode; label: string }> = [
  { value: 'FLEXIBLE', label: '灵活交付' },
  { value: 'FACE_TO_FACE', label: '当面交付' },
  { value: 'DROP_OFF', label: '放置交付' }
];

const contactPreferenceOptions: Array<{ value: CampusServiceContactPreference; label: string }> = [
  { value: 'CHAT_ONLY', label: '仅站内消息' },
  { value: 'PHONE_AFTER_MATCH', label: '接单后电话' },
  { value: 'FLEXIBLE', label: '均可' }
];

export function CampusServicePublishPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handlePublish(values: {
    title: string;
    category: CampusServiceCategory;
    description: string;
    reward: number;
    locationFrom: string;
    locationTo: string;
    deadlineLabel: string;
    estimatedMinutes: number;
    urgency?: CampusServiceUrgency;
    fulfillmentMode?: CampusServiceFulfillmentMode;
    contactPreference?: CampusServiceContactPreference;
    itemCount?: number;
    trustNote?: string;
  }) {
    if (!hasTradingAccess(currentUser)) {
      setMessage({
        type: 'error',
        text: isGuestUser(currentUser) ? '浏览账号不能发布校园服务任务。' : '请先登录普通用户账号后再发布。'
      });
      return;
    }

    setSubmitting(true);
    try {
      const created = await createCampusServiceTask(values);
      setMessage({ type: 'success', text: `已发布“${values.title}”。` });
      form.resetFields();
      void navigate('/campus-services', { state: { selectedTaskId: created.id } });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '发布失败，请稍后重试。') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-grid campus-service-page">
      <section className="page-topbar service-market-topbar">
        <div className="page-topbar-copy">
          <h1>发布委托</h1>
        </div>
      </section>

      <div className="two-col service-market-layout">
        <PageCard>
          <SectionHeader title="发布委托" className="is-spacious" />
          {message ? <Alert type={message.type} showIcon message={message.text} closable onClose={() => setMessage(null)} style={{ marginBottom: 16 }} /> : null}
          <Form form={form} layout="vertical" onFinish={handlePublish} className="form-shell service-market-form">
            <div className="service-market-form-grid">
              <Form.Item name="title" label="任务标题" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="category" label="服务类型" rules={[{ required: true }]}>
                <Select
                  options={moduleConfig.map((item) => ({
                    value: item.key,
                    label: item.title
                  }))}
                />
              </Form.Item>
              <Form.Item name="reward" label="酬谢金额" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} prefix="¥" />
              </Form.Item>
              <Form.Item name="itemCount" label="件数" initialValue={1} rules={[{ required: true }]}>
                <InputNumber min={1} max={20} style={{ width: '100%' }} suffix="件" />
              </Form.Item>
              <Form.Item name="estimatedMinutes" label="预计耗时" rules={[{ required: true }]}>
                <InputNumber min={5} max={180} style={{ width: '100%' }} suffix="分钟" />
              </Form.Item>
              <Form.Item name="urgency" label="紧急程度" initialValue="NORMAL" rules={[{ required: true }]}>
                <Select options={urgencyOptions} />
              </Form.Item>
              <Form.Item name="fulfillmentMode" label="交付方式" initialValue="FLEXIBLE" rules={[{ required: true }]}>
                <Select options={fulfillmentModeOptions} />
              </Form.Item>
              <Form.Item name="contactPreference" label="联系偏好" initialValue="CHAT_ONLY" rules={[{ required: true }]}>
                <Select options={contactPreferenceOptions} />
              </Form.Item>
              <Form.Item name="locationFrom" label="出发点" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="locationTo" label="送达点" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </div>
            <Form.Item name="deadlineLabel" label="时间要求" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="description" label="补充说明" rules={[{ required: true }]}>
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item name="trustNote" label="交接备注">
              <Input />
            </Form.Item>
            <ActionRow>
              <Button type="primary" htmlType="submit" loading={submitting} icon={<PlusOutlined />}>
                发布委托
              </Button>
            </ActionRow>
          </Form>
        </PageCard>

        <div className="page-grid">
          <PageCard>
            <SectionHeader title="常用路线" className="is-spacious" />
            <div className="service-route-list">
              {bjfuServiceRoutePresets.map((route) => (
                <button
                  key={route.label}
                  type="button"
                  className="service-route-item"
                  onClick={() => {
                    form.setFieldsValue({
                      locationFrom: route.from,
                      locationTo: route.to
                    });
                  }}
                >
                  <strong>{route.label}</strong>
                  <span>{`${route.from} -> ${route.to}`}</span>
                </button>
              ))}
            </div>
          </PageCard>

          <PageCard>
            <SectionHeader title="地点辅助" className="is-spacious" />
            <div className="service-location-board compact">
              {bjfuLocationSections.slice(0, 6).map((section) => (
                <div key={section.label} className="service-location-group">
                  <strong>{section.label}</strong>
                  <div className="service-location-tags">
                    {section.items.slice(0, 6).map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="service-location-tag"
                        onClick={() => form.setFieldsValue({ locationFrom: item })}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PageCard>
        </div>
      </div>
    </div>
  );
}
