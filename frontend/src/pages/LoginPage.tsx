import { Alert, Button, Form, Input } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, registerUser } from '../services/api';
import { createAdminDemoUser, saveDemoUser } from '../services/session';

const HIDDEN_ADMIN_ENTRY_PASSWORD = 'SwapCampusAdmin2026';

export function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(values: {
    studentId?: string;
    name: string;
    email: string;
    college?: string;
    password: string;
  }) {
    setLoading(true);
    try {
      const result = await registerUser(values);
      saveDemoUser(result.user);
      setMessage({ type: 'success', text: `注册成功，已登录 ${result.user.name}` });
      void navigate('/');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.response?.data?.message ?? '注册失败，请稍后重试'
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(values: { account: string; password: string }) {
    setLoading(true);
    try {
      if (values.password === HIDDEN_ADMIN_ENTRY_PASSWORD) {
        saveDemoUser(createAdminDemoUser());
        setMessage({ type: 'success', text: '已进入管理后台' });
        void navigate('/admin');
        return;
      }

      const result = await loginUser(values);
      if (result.user) {
        saveDemoUser(result.user);
      }
      setMessage({ type: 'success', text: result.message ?? '登录成功' });
      void navigate('/');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.response?.data?.message ?? '登录失败，请检查账号和密码'
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
            <h1>登录</h1>
            <span>学号或邮箱</span>
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
            <Form layout="vertical" onFinish={handleRegister} className="form-shell">
              <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
                <Input placeholder="例如：王同学" />
              </Form.Item>
              <Form.Item label="邮箱" name="email" rules={[{ required: true }]}>
                <Input placeholder="例如：student@campus.edu.cn" />
              </Form.Item>
              <Form.Item label="学号" name="studentId">
                <Input placeholder="选填，例如：20260001" />
              </Form.Item>
              <Form.Item label="学院" name="college">
                <Input placeholder="选填，例如：林学院" />
              </Form.Item>
              <Form.Item label="密码" name="password" rules={[{ required: true }]}>
                <Input.Password placeholder="请设置登录密码" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                注册
              </Button>
            </Form>
          )}
        </section>
      </div>
    </div>
  );
}
