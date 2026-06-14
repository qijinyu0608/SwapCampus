import { Form, Input, Modal, Radio, Select } from 'antd';

export type ReportIdentityMode = 'REAL_NAME' | 'ANONYMOUS';

export type ReportFormValues = {
  type: string;
  detail: string;
  identityMode: ReportIdentityMode;
  contactConsent: 'YES' | 'NO';
};

type ReportFormModalProps = {
  open: boolean;
  loading?: boolean;
  typeOptions: string[];
  realNameAvailable: boolean;
  form: ReturnType<typeof Form.useForm<ReportFormValues>>[0];
  onCancel: () => void;
  onSubmit: () => void;
};

export function ReportFormModal({
  open,
  loading = false,
  typeOptions,
  realNameAvailable,
  form,
  onCancel,
  onSubmit
}: ReportFormModalProps) {
  return (
    <Modal
      title="提交举报"
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      okText="提交举报"
      cancelText="取消"
      confirmLoading={loading}
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        className="detail-report-form"
        initialValues={{
          type: typeOptions[0],
          identityMode: realNameAvailable ? 'REAL_NAME' : 'ANONYMOUS',
          contactConsent: 'YES'
        }}
      >
        <Form.Item name="type" label="举报类型" rules={[{ required: true, message: '请选择举报类型' }]}>
          <Select options={typeOptions.map((item) => ({ label: item, value: item }))} />
        </Form.Item>
        <Form.Item name="identityMode" label="举报方式" rules={[{ required: true }]}>
          <Radio.Group className="detail-report-radio">
            <Radio value="REAL_NAME">实名举报</Radio>
            <Radio value="ANONYMOUS">匿名展示</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="contactConsent" label="后续核查" rules={[{ required: true }]}>
          <Radio.Group className="detail-report-radio">
            <Radio value="YES">愿意配合管理员补充材料</Radio>
            <Radio value="NO">仅提交当前信息</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          name="detail"
          label="举报说明"
          rules={[
            { required: true, message: '请填写举报说明' },
            { min: 8, message: '说明至少 8 个字' }
          ]}
        >
          <Input.TextArea
            rows={5}
            maxLength={300}
            showCount
            placeholder="请描述问题、聊天经过、交易时间或可核查线索"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
