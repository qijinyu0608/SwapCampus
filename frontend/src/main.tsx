import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import 'antd/dist/reset.css';
import '@leenguyen/react-flip-clock-countdown/dist/index.css';
import { App } from './App';
import { initAuth } from './services/auth';
import './styles/index.css';
import { antdTheme } from './theme/tokens';

initAuth();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={antdTheme}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
