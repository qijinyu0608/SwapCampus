import { Alert, Button, Form, Input, Select, message as antMessage } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ImageCropUploadModal } from '../components/image-upload';
import { UserAvatar } from '../components/user/UserAvatar';
import { AVATAR_OPTIONS } from '../constants/avatarOptions';
import { BJFU_COLLEGES } from '../constants/colleges';
import { getApiErrorMessage, loginUser, registerUser, updateUserProfile, uploadImageAsset } from '../services/api';
import { useAuthState } from '../services/auth-state';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentUser } = useAuthState();
  const [form] = Form.useForm<{
    studentId?: string;
    displayName: string;
    email: string;
    college?: string;
    avatarUrl?: string;
    password: string;
    confirmPassword: string;
  }>();
  const initialMode = (location.state as { mode?: unknown } | null)?.mode === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [customAvatarPreviewUrl, setCustomAvatarPreviewUrl] = useState<string | null>(null);
  const [customAvatarFile, setCustomAvatarFile] = useState<File | null>(null);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>(AVATAR_OPTIONS[0]?.src ?? '');
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
  }, [customAvatarPreviewUrl]);

  async function handleRegister(values: {
    studentId?: string;
    displayName: string;
    email: string;
    college?: string;
    avatarUrl?: string;
    password: string;
    confirmPassword: string;
  }) {
    setLoading(true);
    try {
      const { confirmPassword: _confirmPassword, ...payload } = values;
      const registerPayload = {
        ...payload,
        avatarUrl: customAvatarFile ? undefined : selectedAvatarUrl || undefined
      };
      const result = await registerUser(registerPayload);
      if (customAvatarFile) {
        try {
          const uploaded = await uploadImageAsset(customAvatarFile, 'avatar');
          const profile = await updateUserProfile(result.user.id, {
            displayName: values.displayName,
            email: values.email,
            realName: values.displayName,
            college: values.college?.trim() || '待填写',
            phone: '待填写',
            avatarUrl: uploaded.url
          });
          result.user.avatarUrl = profile.avatarUrl ?? uploaded.url;
        } catch (error) {
          antMessage.warning(getApiErrorMessage(error, '注册成功，但头像上传失败，请稍后在资料页补充'));
        }
      }
      setCurrentUser(result.user);
      if (!customAvatarFile) {
        setMessage({ type: 'success', text: `注册成功，已登录 ${result.user.displayName}` });
      }
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

  function handlePresetAvatarSelect(src: string) {
    if (customAvatarPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(customAvatarPreviewUrl);
    }
    setCustomAvatarPreviewUrl(null);
    setCustomAvatarFile(null);
    setSelectedAvatarUrl(src);
  }

  const usingCustomAvatar = Boolean(selectedAvatarUrl?.startsWith('blob:'));

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
              <Form.Item label="展示名" name="displayName" rules={[{ required: true }]}>
                <Input placeholder="例如：王同学" />
              </Form.Item>
              <Form.Item label="邮箱" name="email" rules={[{ required: true }]}>
                <Input placeholder="例如：student@campus.edu.cn" />
              </Form.Item>
              <Form.Item label="学号" name="studentId">
                <Input placeholder="选填，例如：20260001" />
              </Form.Item>
              <Form.Item label="学院" name="college">
                <Select
                  placeholder="请选择学院"
                  options={BJFU_COLLEGES.map((item) => ({ value: item, label: item }))}
                  allowClear
                />
              </Form.Item>

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
    </div>
  );
}
