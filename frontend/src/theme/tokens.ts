export const appTokens = {
  colorPrimary: '#ffb000',
  colorPrimaryHover: '#ffbe33',
  colorPrimaryActive: '#ff8a00',
  colorBgLayout: '#f7f8fa',
  colorBgContainer: '#ffffff',
  colorTextBase: '#111827',
  colorTextSecondary: '#6b7280',
  colorBorder: '#e7e9ee',
  borderRadius: 8,
  borderRadiusLG: 12,
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
  boxShadowSecondary: '0 2px 10px rgba(15, 23, 42, 0.04)',
  fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  contentWidth: '1320px',
  contentWideWidth: '1880px'
} as const;

export const antdTheme = {
  token: {
    colorPrimary: appTokens.colorPrimary,
    colorBgLayout: appTokens.colorBgLayout,
    colorBgContainer: appTokens.colorBgContainer,
    colorTextBase: appTokens.colorTextBase,
    colorTextSecondary: appTokens.colorTextSecondary,
    colorBorder: appTokens.colorBorder,
    colorPrimaryHover: appTokens.colorPrimaryHover,
    colorPrimaryActive: appTokens.colorPrimaryActive,
    borderRadius: appTokens.borderRadius,
    borderRadiusLG: appTokens.borderRadiusLG,
    boxShadow: appTokens.boxShadow,
    boxShadowSecondary: appTokens.boxShadowSecondary,
    fontFamily: appTokens.fontFamily
  }
} as const;
