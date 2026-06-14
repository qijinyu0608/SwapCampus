import {
  CustomerServiceOutlined,
  HomeOutlined,
  LoginOutlined,
  LogoutOutlined,
  MessageOutlined,
  PlusCircleOutlined,
  SafetyCertificateOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Tooltip } from 'antd';
import { useRef, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logoutUser } from '../../services/api';
import { useAuthState } from '../../services/auth-state';
import { hasAdminAccess, hasTradingAccess, type SessionUser } from '../../services/session';

type TopBarProps = {
  currentUser: SessionUser | null;
};

type NavIconItem = {
  key: string;
  to: string;
  label: string;
  tooltip?: string;
  icon: React.ReactNode;
  activeMatch?: (pathname: string) => boolean;
};

const LOGO_VIEWBOX = '0 0 656 133';
const LOGO_WIDTH = 656;
const LOGO_HEIGHT = 133;
const LOGO_SPOT_Y_OFFSET = 18;
const LOGO_SPOT_EDGE_PADDING = 18;
const LOGO_PATH =
  'M31.400 99.160Q23.840 99.160 18.080 96.520Q12.320 93.880 9.200 89.140Q6.080 84.400 6.080 78.160Q6.080 72.880 8.300 68.560Q10.520 64.240 14.300 61.720Q18.080 59.200 22.640 59.200Q26.840 59.200 29.720 61.300Q32.600 63.400 33.320 67.120Q27.080 67.120 23.360 70.420Q19.640 73.720 19.640 79.360Q19.640 84.520 22.760 87.640Q25.880 90.760 31.040 90.760Q37.400 90.760 41.540 86.500Q45.680 82.240 45.680 75.760Q45.680 70.120 42.560 65.080Q39.440 60.040 33.200 52.840Q26.720 45.400 23.420 40.060Q20.120 34.720 20.120 28.360Q20.120 22.120 23.600 17.140Q27.080 12.160 33.200 9.280Q39.320 6.400 47 6.400Q56.720 6.400 62.540 10.960Q68.360 15.520 68.360 23.200Q68.360 28.240 65.840 31.360Q63.320 34.480 59.240 34.480Q54.680 34.480 51.920 30.760Q54.200 29.080 55.520 26.320Q56.840 23.560 56.840 20.560Q56.840 16.720 54.560 14.440Q52.280 12.160 48.320 12.160Q43.520 12.160 40.460 15.580Q37.400 19 37.400 24.280Q37.400 29.080 40.160 33.220Q42.920 37.360 48.800 43.840Q53.600 49 56.540 52.720Q59.480 56.440 61.580 61.300Q63.680 66.160 63.680 71.800Q63.680 79.480 59.420 85.720Q55.160 91.960 47.780 95.560Q40.400 99.160 31.400 99.160M82.280 97.720Q76.520 97.720 72.980 94.120Q69.440 90.520 69.440 83.320Q69.440 80.320 70.400 75.520L78.560 37L95.840 37L87.200 77.800Q86.840 79.240 86.840 80.800Q86.840 86.080 90.440 86.080Q93.800 86.080 96.200 83.260Q98.600 80.440 100.040 75.520L108.200 37L125.480 37L116.840 77.800Q116.240 80.800 116.240 82.120Q116.240 86.080 120.320 86.080Q125.840 86.080 130.580 79.120Q135.320 72.160 138.200 62.560Q141.080 52.960 141.080 46Q140.840 46.600 139.520 46.900Q138.200 47.200 137.240 47.200Q135.200 47.200 134.060 45.280Q132.920 43.360 132.920 41.080Q132.920 38.200 134.780 36.400Q136.640 34.600 140.360 34.600Q144.320 34.600 146.120 37.540Q147.920 40.480 147.920 45.040Q147.920 55.840 144.200 68.140Q140.480 80.440 132.800 89.080Q125.120 97.720 113.720 97.720Q107.840 97.720 104.120 95.200Q100.400 92.680 99.320 87.640Q92.600 97.720 82.280 97.720M164.120 97.720Q157.280 97.720 152.720 93.040Q148.160 88.360 148.160 78.400Q148.160 69.520 151.700 59.740Q155.240 49.960 162.260 43.180Q169.280 36.400 179 36.400Q183.920 36.400 186.320 38.080Q188.720 39.760 188.720 42.520L188.720 43.360L190.040 37L207.320 37L198.680 77.800Q198.200 79.600 198.200 81.640Q198.200 86.800 203.120 86.800Q206.480 86.800 208.940 83.680Q211.400 80.560 212.840 75.520L217.880 75.520Q213.440 88.480 206.900 93.100Q200.360 97.720 193.760 97.720Q188.720 97.720 185.660 94.900Q182.600 92.080 182 86.680Q178.520 91.600 174.260 94.660Q170 97.720 164.120 97.720M171.920 86.080Q174.920 86.080 177.860 83.260Q180.800 80.440 181.880 75.520L187.640 48.400Q187.640 46.840 186.440 45.340Q185.240 43.840 182.720 43.840Q177.920 43.840 174.080 49.420Q170.240 55 168.080 62.860Q165.920 70.720 165.920 76.720Q165.920 82.720 167.660 84.400Q169.400 86.080 171.920 86.080M201.920 127L221.960 32.560L239.240 32.560L237.320 41.560Q243.320 36.400 251.360 36.400Q258.080 36.400 262.040 40.840Q266 45.280 266 55.360Q266 64.840 263.240 74.500Q260.480 84.160 253.880 90.940Q247.280 97.720 236.480 97.720Q228.800 97.720 226.280 93.400L220.040 122.680L201.920 127M232.760 87.280Q238.520 87.280 242.300 81.880Q246.080 76.480 247.820 68.980Q249.560 61.480 249.560 55Q249.560 45.040 243.560 45.040Q241.400 45.040 239.180 46.600Q236.960 48.160 235.280 50.920L228.200 84.520Q229.160 87.280 232.760 87.280M297.560 98.920Q284 98.920 277.640 92.080Q271.280 85.240 271.280 69.400Q271.280 56.800 275.540 42.280Q279.800 27.760 289.220 17.380Q298.640 7 313.160 7Q322.160 7 327.680 10.960Q333.200 14.920 333.200 23.080Q333.200 28.240 331.160 31.180Q329.120 34.120 324.800 34.120Q320.480 34.120 317.960 31Q320.120 29.920 321.800 26.680Q323.480 23.440 323.480 19.960Q323.480 16.720 321.740 14.680Q320 12.640 316.160 12.640Q309.800 12.640 304.040 21.340Q298.280 30.040 294.740 43.240Q291.200 56.440 291.200 68.680Q291.200 77.800 294.320 82.600Q297.440 87.400 305.600 87.400Q312.680 87.400 318.680 84.280Q324.680 81.160 329 75.400L331.760 76.600Q328.760 84.160 322.880 89.200Q317 94.240 310.280 96.580Q303.560 98.920 297.560 98.920M343.040 97.720Q336.200 97.720 331.640 93.040Q327.080 88.360 327.080 78.400Q327.080 69.520 330.620 59.740Q334.160 49.960 341.180 43.180Q348.200 36.400 357.920 36.400Q362.840 36.400 365.240 38.080Q367.640 39.760 367.640 42.520L367.640 43.360L368.960 37L386.240 37L377.600 77.800Q377.120 79.600 377.120 81.640Q377.120 86.800 382.040 86.800Q385.400 86.800 387.860 83.680Q390.320 80.560 391.760 75.520L396.800 75.520Q392.360 88.480 385.820 93.100Q379.280 97.720 372.680 97.720Q367.640 97.720 364.580 94.900Q361.520 92.080 360.920 86.680Q357.440 91.600 353.180 94.660Q348.920 97.720 343.040 97.720M350.840 86.080Q353.840 86.080 356.780 83.260Q359.720 80.440 360.800 75.520L366.560 48.400Q366.560 46.840 365.360 45.340Q364.160 43.840 361.640 43.840Q356.840 43.840 353 49.420Q349.160 55 347 62.860Q344.840 70.720 344.840 76.720Q344.840 82.720 346.580 84.400Q348.320 86.080 350.840 86.080M464.720 97.720Q457.400 97.720 453.980 93.820Q450.560 89.920 450.560 84.160Q450.560 81.640 451.160 78.460Q451.760 75.280 452.420 72.280Q453.080 69.280 453.320 68.440Q454.280 64.240 455.120 60.160Q455.960 56.080 455.960 53.560Q455.960 47.440 451.640 47.440Q448.520 47.440 446.120 50.500Q443.720 53.560 442.280 58.480L434.120 97L416.840 97L425.600 55.600Q425.960 54.160 425.960 52.600Q425.960 47.320 422.360 47.320Q419 47.320 416.540 50.380Q414.080 53.440 412.640 58.480L404.480 97L387.200 97L399.920 37L417.200 37L415.880 43.240Q422 36.400 430.520 36.400Q441.080 36.400 442.880 46.720Q449.480 36.520 459.560 36.520Q465.680 36.520 469.280 39.880Q472.880 43.240 472.880 50.080Q472.880 53.560 472.040 57.820Q471.200 62.080 469.640 68.200Q468.680 71.920 467.900 75.460Q467.120 79 467.120 81.040Q467.120 83.440 468.200 84.760Q469.280 86.080 471.920 86.080Q475.520 86.080 477.680 83.500Q479.840 80.920 482 75.520L487.040 75.520Q482.600 88.720 476.780 93.220Q470.960 97.720 464.720 97.720M471.080 127L491.120 32.560L508.400 32.560L506.480 41.560Q512.480 36.400 520.520 36.400Q527.240 36.400 531.200 40.840Q535.160 45.280 535.160 55.360Q535.160 64.840 532.400 74.500Q529.640 84.160 523.040 90.940Q516.440 97.720 505.640 97.720Q497.960 97.720 495.440 93.400L489.200 122.680L471.080 127M501.920 87.280Q507.680 87.280 511.460 81.880Q515.240 76.480 516.980 68.980Q518.720 61.480 518.720 55Q518.720 45.040 512.720 45.040Q510.560 45.040 508.340 46.600Q506.120 48.160 504.440 50.920L497.360 84.520Q498.320 87.280 501.920 87.280M550.040 97.720Q544.280 97.720 540.740 94.120Q537.200 90.520 537.200 83.320Q537.200 80.320 538.160 75.520L546.320 37L563.600 37L554.960 77.800Q554.600 79.600 554.600 81.160Q554.600 86.080 558.200 86.080Q561.560 86.080 563.960 83.260Q566.360 80.440 567.800 75.520L575.960 37L593.240 37L584.600 77.800Q584.120 79.600 584.120 81.640Q584.120 84.040 585.260 85.060Q586.400 86.080 589.040 86.080Q592.400 86.080 594.860 83.200Q597.320 80.320 598.760 75.520L603.800 75.520Q599.360 88.480 592.820 93.100Q586.280 97.720 579.680 97.720Q574.520 97.720 571.460 94.840Q568.400 91.960 567.800 86.320Q563.720 92.920 559.220 95.320Q554.720 97.720 550.040 97.720M612.440 97.720Q606.680 97.720 602.720 95.500Q598.760 93.280 596.840 89.740Q594.920 86.200 594.920 82.360Q594.920 78.400 596.780 75.460Q598.640 72.520 601.280 71.200Q605.960 62.800 609.440 54.220Q612.920 45.640 616.040 35.680L633.800 33.280Q634.400 48.640 635.840 66.520Q636.440 73.720 636.440 76.960Q636.440 79.720 635.960 81.520Q641.600 78.280 644.600 75.520L649.640 75.520Q641.960 84.400 631.280 90.520Q627.800 94.240 622.700 95.980Q617.600 97.720 612.440 97.720M608.600 88.240Q613.040 88.240 616.040 85.600Q619.040 82.960 619.040 77.080Q619.040 73.480 618.320 67Q617.120 53.320 616.760 48.640Q613.880 58.120 607.040 71.320Q609.800 72.760 609.800 75.520Q609.800 77.800 608.300 79.600Q606.800 81.400 604.520 81.400Q602 81.400 601.280 79.840Q601.280 84.160 603.020 86.200Q604.760 88.240 608.600 88.240';

function IconLink({
  to,
  label,
  tooltip,
  icon,
  active
}: {
  to: string;
  label: string;
  tooltip?: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Tooltip title={tooltip ?? label}>
      <Link to={to} className={active ? 'topbar-nav-button active' : 'topbar-nav-button'} aria-label={tooltip ?? label}>
        <span className="topbar-nav-icon">{icon}</span>
        <span className="topbar-nav-label">{label}</span>
      </Link>
    </Tooltip>
  );
}

export function TopBar({ currentUser }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCurrentUser } = useAuthState();
  const logoSpotRef = useRef<SVGCircleElement | null>(null);

  const adminMode = hasAdminAccess(currentUser);
  const userMode = hasTradingAccess(currentUser);
  const authenticatedMode = adminMode || userMode;

  const leftItems: NavIconItem[] = adminMode
    ? [
        {
          key: 'home',
          to: '/',
          label: '首页',
          icon: <HomeOutlined />,
          activeMatch: (pathname) => pathname === '/'
        }
      ]
    : userMode
      ? [
        {
          key: 'home',
          to: '/',
          label: '首页',
          icon: <HomeOutlined />,
          activeMatch: (pathname) => pathname === '/'
        },
        {
          key: 'campus-services',
          to: '/campus-services',
          label: '校园服务',
          icon: <CustomerServiceOutlined />,
          activeMatch: (pathname) => pathname.startsWith('/campus-services')
        }
      ]
      : [
          {
            key: 'home',
            to: '/',
            label: '首页',
            icon: <HomeOutlined />,
            activeMatch: (pathname) => pathname === '/'
          }
        ];

  const rightItems: NavIconItem[] = adminMode
    ? [
        {
          key: 'admin',
          to: '/admin',
          label: '后台',
          icon: <SafetyCertificateOutlined />,
          activeMatch: (pathname) => pathname.startsWith('/admin')
        },
        {
          key: 'profile',
          to: '/profile',
          label: '我的',
          icon: <UserOutlined />,
          activeMatch: (pathname) => pathname.startsWith('/profile')
        }
      ]
    : userMode
      ? [
        {
          key: 'publish',
          to: '/publish',
          label: '发布',
          tooltip: '发布内容',
          icon: <PlusCircleOutlined />,
          activeMatch: (pathname) => pathname.startsWith('/publish')
        },
        {
          key: 'messages',
          to: '/messages',
          label: '消息',
          icon: <MessageOutlined />,
          activeMatch: (pathname) => pathname.startsWith('/messages')
        },
        {
          key: 'profile',
          to: '/profile',
          label: '我的',
          icon: <UserOutlined />,
          activeMatch: (pathname) => pathname.startsWith('/profile') || pathname.startsWith('/favorites')
        }
      ]
      : [
          {
            key: 'login',
            to: '/login',
            label: '登录',
            tooltip: '登录 / 注册',
            icon: <LoginOutlined />,
            activeMatch: (pathname) => pathname.startsWith('/login')
          }
        ];

  async function handleLogout() {
    try {
      await logoutUser();
    } catch {
      // Ignore session revoke failures and clear local cache anyway.
    }
    clearCurrentUser();
    void navigate('/');
  }

  function updateLogoHighlight(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * LOGO_WIDTH;
    const y = ((event.clientY - bounds.top) / bounds.height) * LOGO_HEIGHT + LOGO_SPOT_Y_OFFSET;
    const clampedX = Math.min(Math.max(x, LOGO_SPOT_EDGE_PADDING), LOGO_WIDTH - LOGO_SPOT_EDGE_PADDING);
    const clampedY = Math.min(Math.max(y, LOGO_SPOT_EDGE_PADDING), LOGO_HEIGHT - LOGO_SPOT_EDGE_PADDING);
    logoSpotRef.current?.setAttribute('cx', clampedX.toFixed(2));
    logoSpotRef.current?.setAttribute('cy', clampedY.toFixed(2));
  }

  return (
    <div className="topbar-shell">
      <div className="topbar-cluster topbar-cluster-left">
        {leftItems.map((item) => (
          <IconLink
            key={item.key}
            to={item.to}
            label={item.label}
            icon={item.icon}
            active={item.activeMatch ? item.activeMatch(location.pathname) : location.pathname === item.to}
          />
        ))}
      </div>

      <div className="topbar-center">
        <div className="topbar-logo-zone" onMouseMove={updateLogoHighlight}>
          <div className="topbar-logo" role="img" aria-label="SwapCampus">
            <svg className="topbar-logo-svg" viewBox={LOGO_VIEWBOX} aria-hidden="true" focusable="false">
              <defs>
                <radialGradient id="topbar-logo-highlight" cx="50%" cy="50%" r="58%">
                  <stop offset="0%" stopColor="var(--signature-highlight-core)" />
                  <stop offset="28%" stopColor="var(--signature-highlight-gold)" />
                  <stop offset="54%" stopColor="var(--signature-highlight-amber)" />
                  <stop offset="74%" stopColor="var(--signature-highlight-peach)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                <linearGradient id="topbar-logo-shimmer" x1="-20%" y1="0%" x2="120%" y2="100%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="28%" stopColor="var(--signature-highlight-halo-soft)" />
                  <stop offset="50%" stopColor="var(--signature-highlight-core-soft)" />
                  <stop offset="72%" stopColor="var(--signature-highlight-halo-soft)" />
                  <stop offset="100%" stopColor="transparent" />
                  <animateTransform
                    attributeName="gradientTransform"
                    type="translate"
                    values="-140 0; 140 0; -140 0"
                    dur="5.6s"
                    repeatCount="indefinite"
                  />
                </linearGradient>
                <radialGradient id="topbar-logo-highlight-mask-spot" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="white" />
                  <stop offset="42%" stopColor="rgba(255,255,255,0.96)" />
                  <stop offset="72%" stopColor="rgba(255,255,255,0.42)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                <mask id="topbar-logo-highlight-mask" maskUnits="userSpaceOnUse">
                  <rect width="656" height="133" fill="black" />
                  <circle
                    ref={logoSpotRef}
                    className="topbar-logo-mask-spot"
                    cx={String(LOGO_WIDTH / 2)}
                    cy={String(LOGO_HEIGHT / 2)}
                    r="0"
                    fill="url(#topbar-logo-highlight-mask-spot)"
                  />
                </mask>
              </defs>
              <path className="topbar-logo-base" d={LOGO_PATH} />
              <path
                className="topbar-logo-highlight"
                d={LOGO_PATH}
                fill="url(#topbar-logo-highlight)"
                mask="url(#topbar-logo-highlight-mask)"
              />
              <path
                className="topbar-logo-shimmer"
                d={LOGO_PATH}
                fill="url(#topbar-logo-shimmer)"
                mask="url(#topbar-logo-highlight-mask)"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="topbar-cluster topbar-cluster-right">
        {rightItems.map((item) => (
          <IconLink
            key={item.key}
            to={item.to}
            label={item.label}
            tooltip={item.tooltip}
            icon={item.icon}
            active={item.activeMatch ? item.activeMatch(location.pathname) : location.pathname === item.to}
          />
        ))}
        {authenticatedMode ? (
          <Tooltip title="退出登录">
            <button type="button" className="topbar-nav-button topbar-nav-button-ghost" aria-label="退出登录" onClick={handleLogout}>
              <span className="topbar-nav-icon">
              <LogoutOutlined />
              </span>
              <span className="topbar-nav-label">退出</span>
            </button>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
