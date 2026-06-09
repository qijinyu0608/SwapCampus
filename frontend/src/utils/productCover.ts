import { normalizeProductCategoryName, type ProductCategoryName } from '../constants/productCategories';

type CoverInput = {
  title: string;
  category: string;
  price: number;
  condition?: string;
  sellerName?: string;
  variant?: number;
};

const categoryThemes: Record<ProductCategoryName, { start: string; end: string; accent: string; ink: string; line: string }> = {
  数码电子: { start: '#f7f8fb', end: '#eeeff3', accent: '#5f7391', ink: '#18212f', line: '#d5dbe4' },
  教材资料: { start: '#fbfaf7', end: '#f1eee7', accent: '#9b7d57', ink: '#241f18', line: '#ddd4c6' },
  宿舍生活: { start: '#fbfaf7', end: '#f2efe8', accent: '#9c8464', ink: '#231f18', line: '#ded5c8' },
  鞋服箱包: { start: '#faf7f7', end: '#f2ecec', accent: '#8b7068', ink: '#2a211f', line: '#dececa' },
  运动出行: { start: '#f7faf8', end: '#edf3ef', accent: '#6d8a74', ink: '#1d251f', line: '#d5dfd8' },
  美妆个护: { start: '#fcf7fa', end: '#f6eef5', accent: '#9c6c84', ink: '#2c1f28', line: '#e3d2db' },
  办公文具: { start: '#faf9f6', end: '#f2eee6', accent: '#8c7560', ink: '#2b241d', line: '#ddd3c6' },
  卡券票务: { start: '#fffaf3', end: '#f8f0df', accent: '#a67a1f', ink: '#2c220d', line: '#e6d7b0' },
  兴趣文娱: { start: '#f8f7fb', end: '#efedf8', accent: '#7567a1', ink: '#211d30', line: '#d8d3e7' },
  其他: { start: '#f8f8f6', end: '#efefe9', accent: '#7b8576', ink: '#1f241e', line: '#d8ddd3' }
};

const offsets = [
  { x: 0, y: 0 },
  { x: 6, y: -4 },
  { x: -8, y: 5 }
];

export const DEMO_PRODUCT_IMAGE = '/images/products/demo-square.png';

function escapeSvgText(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function splitTitle(title: string) {
  if (title.length <= 10) {
    return [title];
  }

  return [title.slice(0, 10), title.slice(10, 20)];
}

function renderCategoryShape(category: string, accent: string, line: string, x: number, y: number) {
  if (category === '数码电子') {
    return `
      <rect x="${220 + x}" y="${138 + y}" width="280" height="168" rx="18" fill="#ffffff" stroke="${line}" stroke-width="6" />
      <rect x="${242 + x}" y="${160 + y}" width="236" height="124" rx="10" fill="#eef2f7" />
      <rect x="${308 + x}" y="${318 + y}" width="104" height="14" rx="7" fill="${accent}" opacity="0.88" />
      <rect x="${334 + x}" y="${332 + y}" width="52" height="28" rx="8" fill="${line}" />
    `;
  }

  if (category === '教材资料') {
    return `
      <rect x="${214 + x}" y="${156 + y}" width="88" height="168" rx="12" fill="${accent}" opacity="0.92" />
      <rect x="${314 + x}" y="${144 + y}" width="92" height="180" rx="12" fill="#ffffff" stroke="${line}" stroke-width="6" />
      <rect x="${418 + x}" y="${168 + y}" width="84" height="156" rx="12" fill="#f4f1eb" stroke="${line}" stroke-width="6" />
      <rect x="${232 + x}" y="${176 + y}" width="50" height="8" rx="4" fill="#ffffff" opacity="0.52" />
      <rect x="${332 + x}" y="${174 + y}" width="56" height="8" rx="4" fill="${accent}" opacity="0.16" />
    `;
  }

  if (category === '运动出行') {
    return `
      <circle cx="${324 + x}" cy="${220 + y}" r="72" fill="none" stroke="${accent}" stroke-width="14" />
      <circle cx="${324 + x}" cy="${220 + y}" r="48" fill="none" stroke="${line}" stroke-width="8" />
      <rect x="${390 + x}" y="${266 + y}" width="136" height="20" rx="10" transform="rotate(38 390 266)" fill="${accent}" />
      <circle cx="${470 + x}" cy="${350 + y}" r="22" fill="#ffffff" stroke="${line}" stroke-width="8" />
    `;
  }

  if (category === '宿舍生活') {
    return `
      <path d="M360 ${140 + y} C308 ${158 + y}, 274 ${210 + y}, 274 ${264 + y} L446 ${264 + y} C446 ${210 + y}, 412 ${158 + y}, 360 ${140 + y}Z" fill="#ffffff" stroke="${line}" stroke-width="8" />
      <rect x="${344 + x}" y="${264 + y}" width="32" height="104" rx="12" fill="${accent}" />
      <rect x="${304 + x}" y="${366 + y}" width="112" height="16" rx="8" fill="${line}" />
      <rect x="${286 + x}" y="${384 + y}" width="148" height="12" rx="6" fill="${accent}" opacity="0.72" />
    `;
  }

  return `
    <rect x="${226 + x}" y="${164 + y}" width="92" height="132" rx="14" fill="#ffffff" stroke="${line}" stroke-width="6" />
    <rect x="${336 + x}" y="${182 + y}" width="154" height="112" rx="14" fill="#f3f4f6" stroke="${line}" stroke-width="6" />
    <rect x="${244 + x}" y="${312 + y}" width="246" height="18" rx="9" fill="${accent}" opacity="0.76" />
    <rect x="${214 + x}" y="${336 + y}" width="306" height="30" rx="15" fill="${line}" />
  `;
}

export function buildProductCover({
  title,
  category,
  price,
  condition = '',
  sellerName = '同校用户',
  variant = 0
}: CoverInput) {
  const normalizedCategory = normalizeProductCategoryName(category);
  const theme = categoryThemes[normalizedCategory] ?? categoryThemes.其他;
  const offset = offsets[variant % offsets.length];
  const titleLines = splitTitle(title);
  const subtitle = [condition, sellerName].filter(Boolean).join(' · ');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="560" viewBox="0 0 720 560">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${theme.start}" />
          <stop offset="100%" stop-color="${theme.end}" />
        </linearGradient>
        <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.96)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.88)" />
        </linearGradient>
      </defs>
      <rect width="720" height="560" rx="20" fill="url(#bg)" />
      <rect x="22" y="22" width="676" height="516" rx="18" fill="rgba(255,255,255,0.34)" />
      <rect x="44" y="42" width="120" height="34" rx="8" fill="rgba(255,255,255,0.94)" />
      <text x="70" y="65" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="20" font-weight="700" fill="${theme.accent}">${escapeSvgText(normalizedCategory)}</text>
      <ellipse cx="360" cy="404" rx="166" ry="30" fill="rgba(17,24,39,0.07)" />
      ${renderCategoryShape(category, theme.accent, theme.line, offset.x, offset.y)}
      <rect x="44" y="426" width="632" height="90" rx="16" fill="url(#panel)" stroke="rgba(209,213,219,0.84)" />
      <text x="64" y="466" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="32" font-weight="800" fill="${theme.ink}">${escapeSvgText(titleLines[0] ?? '')}</text>
      ${titleLines[1] ? `<text x="64" y="502" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="32" font-weight="800" fill="${theme.ink}">${escapeSvgText(titleLines[1])}</text>` : ''}
      <text x="64" y="${titleLines[1] ? 528 : 500}" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="18" font-weight="600" fill="rgba(55,65,81,0.72)">${escapeSvgText(subtitle)}</text>
      <text x="570" y="466" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="rgba(75,85,99,0.72)">SALE</text>
      <text x="534" y="506" font-family="Arial, sans-serif" font-size="42" font-weight="900" fill="#ff5a10">¥${price}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

type ProductImageLike = {
  imageUrl?: string;
  images?: string[];
  title: string;
  category: string;
  price: number;
  condition?: string;
  sellerName?: string;
};

function hasRealImage(url?: string) {
  if (!url) {
    return false;
  }

  return !url.startsWith('data:image/svg+xml');
}

function normalizeImageUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }

  return url.startsWith('/') ? url : `/${url}`;
}

function resolveRealImages(product: ProductImageLike) {
  const imageCandidates = [...(product.images ?? []), product.imageUrl]
    .filter((image): image is string => hasRealImage(image))
    .map(normalizeImageUrl);

  return imageCandidates.filter((image, index) => imageCandidates.indexOf(image) === index);
}

export function resolvePrimaryProductImage(product: ProductImageLike, variant = 0) {
  return DEMO_PRODUCT_IMAGE;
}

export function resolveProductGallery(product: ProductImageLike, variant = 0, count = 4) {
  return Array.from({ length: count }, () => DEMO_PRODUCT_IMAGE);
}

export function getProductImage(product: ProductImageLike, variant = 0) {
  return resolvePrimaryProductImage(product, variant);
}
