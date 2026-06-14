import { Alert, Button, Form, Input, InputNumber, Select, message as antMessage } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ImageCropUploadModal } from '../components/image-upload';
import { UserAvatar } from '../components/user/UserAvatar';
import { AVATAR_OPTIONS } from '../constants/avatarOptions';
import { BJFU_COLLEGES } from '../constants/colleges';
import { getApiErrorMessage, loginUser, registerUserMultipart } from '../services/api';
import { useAuthState } from '../services/auth-state';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentUser } = useAuthState();
  const [form] = Form.useForm<{
    studentId: string;
    displayName: string;
    emailLocalPart: string;
    college?: string;
    graduationYear: number;
    avatarUrl?: string;
    verificationCode: string;
    password: string;
    confirmPassword: string;
  }>();
  const initialMode = (location.state as { mode?: unknown } | null)?.mode === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [studentCardModalOpen, setStudentCardModalOpen] = useState(false);
  const [customAvatarPreviewUrl, setCustomAvatarPreviewUrl] = useState<string | null>(null);
  const [customAvatarFile, setCustomAvatarFile] = useState<File | null>(null);
  const [studentCardPreviewUrl, setStudentCardPreviewUrl] = useState<string | null>(null);
  const [studentCardFile, setStudentCardFile] = useState<File | null>(null);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>(AVATAR_OPTIONS[0]?.src ?? '');
  const [codeSending, setCodeSending] = useState(false);
  const fixedEmailDomain = '@bjfu.edu.cn';
  const nextPath = typeof (location.state as { from?: unknown } | null)?.from === 'string'
    ? (location.state as { from: string }).from
    : null;
  const copy =
    mode === 'login'
      ? {
          title: '登录',
          subtitle: '使用学号或邮箱继续'
        }
      : {
          title: '注册',
          subtitle: '创建一个新的校园账号'
        };

  useEffect(() => () => {
    if (customAvatarPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(customAvatarPreviewUrl);
    }
    if (studentCardPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(studentCardPreviewUrl);
    }
  }, [customAvatarPreviewUrl, studentCardPreviewUrl]);

  async function handleRegister(values: {
    studentId: string;
    displayName: string;
    emailLocalPart: string;
    college?: string;
    graduationYear: number;
    avatarUrl?: string;
    verificationCode: string;
    password: string;
    confirmPassword: string;
  }) {
    if (!studentCardFile) {
      setMessage({ type: 'error', text: '请上传学生证或学生卡照片' });
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword: _confirmPassword, ...payload } = values;
      const email = `${payload.emailLocalPart.trim()}${fixedEmailDomain}`.toLowerCase();
      const formData = new FormData();
      formData.append('studentId', payload.studentId.trim());
      formData.append('displayName', payload.displayName.trim());
      formData.append('email', email);
      formData.append('verificationCode', payload.verificationCode.trim());
      formData.append('graduationYear', String(payload.graduationYear));
      formData.append('password', payload.password);
      if (payload.college?.trim()) {
        formData.append('college', payload.college.trim());
      }
      if (customAvatarFile) {
        formData.append('avatar', customAvatarFile);
      } else if (selectedAvatarUrl) {
        formData.append('avatarUrl', selectedAvatarUrl);
      }
      formData.append('studentCard', studentCardFile);

      const result = await registerUserMultipart(formData);
      setCurrentUser(result.user);
      setMessage({ type: 'success', text: '注册成功，请在 24 小时内等待审核，并留意邮箱反馈结果' });
      void navigate(nextPath || '/');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: getApiErrorMessage(error, '注册失败，请稍后重试')
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCustomAvatarConfirm(file: File, previewUrl: string) {
    if (customAvatarPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(customAvatarPreviewUrl);
    }
    setCustomAvatarFile(file);
    setCustomAvatarPreviewUrl(previewUrl);
    setSelectedAvatarUrl(previewUrl);
    setAvatarModalOpen(false);
    antMessage.success('头像已准备好，注册后会自动上传');
  }

  async function handleStudentCardConfirm(file: File, previewUrl: string) {
    if (studentCardPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(studentCardPreviewUrl);
    }
    setStudentCardFile(file);
    setStudentCardPreviewUrl(previewUrl);
    setStudentCardModalOpen(false);
    antMessage.success('证件照片已准备好');
  }

  function handlePresetAvatarSelect(src: string) {
    if (customAvatarPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(customAvatarPreviewUrl);
    }
    setCustomAvatarPreviewUrl(null);
    setCustomAvatarFile(null);
    setSelectedAvatarUrl(src);
  }

  const usingCustomAvatar = Boolean(selectedAvatarUrl?.startsWith('blob:'));

  async function handleSendVerificationCode() {
    const emailLocalPart = form.getFieldValue('emailLocalPart')?.trim().toLowerCase();
    if (!emailLocalPart) {
      setMessage({ type: 'error', text: '请先填写学校邮箱' });
      return;
    }

    setCodeSending(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      antMessage.info('验证码已发送');
    } finally {
      setCodeSending(false);
    }
  }

  async function handleLogin(values: { account: string; password: string }) {
    setLoading(true);
    try {
      const result = await loginUser(values);
      setCurrentUser(result.user);
      setMessage({ type: 'success', text: result.message ?? '登录成功' });
      void navigate(nextPath || (result.user.role === 'ADMIN' ? '/admin' : '/'));
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: getApiErrorMessage(error, '登录失败，请检查账号和密码')
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-grid">
        <section className="login-panel primary">
          <div className="login-panel-head">
            <h1>{copy.title}</h1>
            <span>{copy.subtitle}</span>
          </div>
          <div className="login-mode-switch">
            <button
              type="button"
              className={mode === 'login' ? 'login-mode-button active' : 'login-mode-button'}
              onClick={() => setMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'login-mode-button active' : 'login-mode-button'}
              onClick={() => setMode('register')}
            >
              注册
            </button>
          </div>
          {message ? <Alert type={message.type} showIcon message={message.text} style={{ marginBottom: 4 }} /> : null}
          {mode === 'login' ? (
            <Form layout="vertical" onFinish={handleLogin} className="form-shell">
              <Form.Item label="账号" name="account" rules={[{ required: true }]}>
                <Input placeholder="学号或邮箱" />
              </Form.Item>
              <Form.Item label="密码" name="password" rules={[{ required: true }]}>
                <Input.Password placeholder="请输入密码" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                登录
              </Button>
            </Form>
          ) : (
            <Form form={form} layout="vertical" onFinish={handleRegister} className="form-shell">
              <div className="register-section">
                <div className="register-section-head">
                  <strong>头像</strong>
                </div>
                <div className="register-avatar-grid" role="radiogroup" aria-label="选择头像">
                  {AVATAR_OPTIONS.map((item, index) => (
                    <button
                      key={item.key}
                      type="button"
                      className={selectedAvatarUrl === item.src ? 'register-avatar-option active' : 'register-avatar-option'}
                      onClick={() => {
                        handlePresetAvatarSelect(item.src);
                      }}
                      aria-pressed={selectedAvatarUrl === item.src}
                      aria-label={item.key === 'default' ? '选择默认头像' : `选择预设头像 ${index}`}
                    >
                      <UserAvatar src={item.src} alt="" fallbackLabel="" />
                    </button>
                  ))}
                  <button
                    type="button"
                    className={usingCustomAvatar ? 'register-avatar-option active custom' : 'register-avatar-option custom'}
                    onClick={() => setAvatarModalOpen(true)}
                    aria-pressed={usingCustomAvatar}
                    aria-label="上传自定义头像"
                  >
                    {usingCustomAvatar ? (
                      <UserAvatar src={selectedAvatarUrl} alt="" fallbackLabel="" />
                    ) : (
                      <span className="register-avatar-upload-placeholder" aria-hidden="true">+</span>
                    )}
                  </button>
                </div>
              </div>

              <div className="register-section">
                <div className="register-section-head">
                  <strong>基础信息</strong>
                </div>
              </div>
              <Form.Item label="用户名" name="displayName" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input placeholder="请输入用户名，可重复" />
              </Form.Item>
              <Form.Item
                label="学校邮箱"
                name="emailLocalPart"
                rules={[
                  { required: true, message: '请输入学校邮箱' },
                  {
                    validator: async (_, value) => {
                      const normalized = String(value ?? '').trim();
                      if (!normalized) {
                        return;
                      }
                      if (!/^[A-Za-z0-9._%+-]+$/.test(normalized)) {
                        throw new Error('邮箱 @ 前仅支持字母、数字和常见符号');
                      }
                    }
                  }
                ]}
              >
                <Input placeholder="例如：202600001" addonAfter={fixedEmailDomain} />
              </Form.Item>
              <Form.Item
                label="邮箱验证码"
                name="verificationCode"
                rules={[{ required: true, message: '请输入验证码' }]}
              >
                <Input
                  placeholder="请输入 6 位验证码"
                  addonAfter={(
                    <button
                      type="button"
                      className="login-inline-action"
                      onClick={() => void handleSendVerificationCode()}
                      disabled={codeSending}
                    >
                      {codeSending ? '发送中' : '发送验证码'}
                    </button>
                  )}
                />
              </Form.Item>
              <Form.Item
                label="学号"
                name="studentId"
                rules={[
                  { required: true, message: '请输入学号' },
                  { pattern: /^\d{9}$/, message: '学号必须为 9 位数字' }
                ]}
              >
                <Input placeholder="例如：202600001" maxLength={9} />
              </Form.Item>
              <Form.Item label="学院" name="college">
                <Select
                  placeholder="请选择学院"
                  options={BJFU_COLLEGES.map((item) => ({ value: item, label: item }))}
                  allowClear
                />
              </Form.Item>
              <Form.Item
                label="毕业年份"
                name="graduationYear"
                rules={[
                  { required: true, message: '请输入毕业年份' },
                  {
                    validator: async (_, value) => {
                      const numeric = Number(value);
                      if (Number.isInteger(numeric) && numeric >= 2000 && numeric <= 2100) {
                        return;
                      }
                      throw new Error('请输入正确的毕业年份');
                    }
                  }
                ]}
              >
                <InputNumber placeholder="例如：2028" min={2000} max={2100} precision={0} style={{ width: '100%' }} />
              </Form.Item>

              <div className="register-section">
                <div className="register-section-head">
                  <strong>身份材料</strong>
                </div>
                <button
                  type="button"
                  className={studentCardPreviewUrl ? 'register-upload-card active' : 'register-upload-card'}
                  onClick={() => setStudentCardModalOpen(true)}
                >
                  {studentCardPreviewUrl ? (
                    <img src={studentCardPreviewUrl} alt="" className="register-upload-preview" />
                  ) : (
                    <span>上传学生证/学生卡照片</span>
                  )}
                </button>
              </div>

              <div className="register-section">
                <div className="register-section-head">
                  <strong>登录安全</strong>
                </div>
              </div>
              <Form.Item label="密码" name="password" rules={[{ required: true }]}>
                <Input.Password placeholder="请设置登录密码" />
              </Form.Item>
              <Form.Item
                label="确认密码"
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请再次输入密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }

                      return Promise.reject(new Error('两次输入的密码不一致'));
                    }
                  })
                ]}
              >
                <Input.Password placeholder="请再次输入密码" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                注册
              </Button>
            </Form>
          )}
        </section>
      </div>
      <ImageCropUploadModal
        open={avatarModalOpen}
        title="上传头像"
        shape="round"
        aspect={1}
        outputWidth={512}
        outputHeight={512}
        onCancel={() => setAvatarModalOpen(false)}
        onConfirm={handleCustomAvatarConfirm}
      />
      <ImageCropUploadModal
        open={studentCardModalOpen}
        title="上传学生证/学生卡照片"
        shape="rect"
        aspect={1.58}
        outputWidth={1600}
        outputHeight={1012}
        confirmText="保存照片"
        onCancel={() => setStudentCardModalOpen(false)}
        onConfirm={handleStudentCardConfirm}
      />
    </div>
  );
}
