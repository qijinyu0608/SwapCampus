import type { ReportFormValues } from '../components/ui';

type ReportActor = {
  displayName?: string | null;
  studentId?: string | null;
  verificationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
};

type OpenReportFormOptions = {
  form: {
    setFieldsValue: (values: Partial<ReportFormValues>) => void;
  };
  currentUser?: ReportActor | null;
  defaultType: string;
  open: () => void;
};

type SubmitReportFormOptions = {
  form: {
    validateFields: () => Promise<ReportFormValues>;
    resetFields: () => void;
  };
  currentUser?: ReportActor | null;
  submit: (reason: string) => Promise<void>;
  onSuccess: () => void;
};

export function openReportForm({
  form,
  currentUser,
  defaultType,
  open
}: OpenReportFormOptions) {
  form.setFieldsValue({
    type: defaultType,
    detail: '',
    identityMode: currentUser?.verificationStatus === 'APPROVED' ? 'REAL_NAME' : 'ANONYMOUS',
    contactConsent: 'YES'
  });
  open();
}

export function buildReportReason(values: ReportFormValues, currentUser?: ReportActor | null) {
  const identityLabel = values.identityMode === 'REAL_NAME'
    ? `实名举报（${currentUser?.displayName ?? '未知用户'} / ${currentUser?.studentId || '无学号'}）`
    : '匿名展示（平台保留账号记录用于核查）';
  const contactLabel = values.contactConsent === 'YES' ? '愿意配合管理员补充材料' : '仅提交当前举报信息';

  return [
    `举报类型：${values.type}`,
    `举报方式：${identityLabel}`,
    `是否配合核查：${contactLabel}`,
    `举报说明：${values.detail.trim()}`
  ].join('\n');
}

export async function submitReportForm({
  form,
  currentUser,
  submit,
  onSuccess
}: SubmitReportFormOptions) {
  const values = await form.validateFields().catch(() => null);
  if (!values) {
    return false;
  }

  await submit(buildReportReason(values, currentUser));
  form.resetFields();
  onSuccess();
  return true;
}
