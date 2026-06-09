export const PRODUCT_CATEGORY_NAMES = [
  '数码电子',
  '教材资料',
  '宿舍生活',
  '鞋服箱包',
  '运动出行',
  '美妆个护',
  '办公文具',
  '卡券票务',
  '兴趣文娱',
  '其他'
] as const;

export type ProductCategoryName = (typeof PRODUCT_CATEGORY_NAMES)[number];

export function isProductCategoryName(category?: string | null): category is ProductCategoryName {
  return Boolean(category) && PRODUCT_CATEGORY_NAMES.includes(category as ProductCategoryName);
}

export function normalizeProductCategoryName(category?: string | null): ProductCategoryName {
  return isProductCategoryName(category) ? category : '其他';
}

export type ProductCategoryHomeGroup = {
  shortTitle: string;
  title: string;
  icon: ProductCategoryHomeGroupIcon;
  rows: Array<{
    label: string;
    items: string[];
  }>;
};

export type ProductCategoryHomeGroupIcon =
  | 'digital'
  | 'book'
  | 'dorm'
  | 'fashion'
  | 'travel'
  | 'beauty'
  | 'office'
  | 'ticket'
  | 'fun'
  | 'other';

export const PRODUCT_CATEGORY_HOME_GROUPS: ProductCategoryHomeGroup[] = [
  {
    shortTitle: '数码电子',
    title: '手机 / 数码 / 电脑',
    icon: 'digital',
    rows: [
      { label: '手机', items: ['iPhone', '安卓机', '备用机', '手机壳'] },
      { label: '电脑', items: ['笔记本', '显示器', '键盘', '鼠标'] },
      { label: '配件', items: ['耳机', '平板', '相机', '充电宝'] }
    ]
  },
  {
    shortTitle: '教材资料',
    title: '教材 / 资料 / 考研',
    icon: 'book',
    rows: [
      { label: '教材', items: ['高数', '计网', '英语', '思政'] },
      { label: '考试', items: ['考研真题', '四六级', '期末资料', '网课笔记'] },
      { label: '学习', items: ['活页本', '计算器', '书立', '计时器'] }
    ]
  },
  {
    shortTitle: '宿舍生活',
    title: '宿舍 / 收纳 / 日用',
    icon: 'dorm',
    rows: [
      { label: '宿舍', items: ['折叠桌', '床帘', '靠垫', '鞋架'] },
      { label: '白名单', items: ['电脑', '非充电台灯', '平板', '充电宝'] },
      { label: '收纳', items: ['置物架', '收纳篮', '挂钩', '收纳箱'] }
    ]
  },
  {
    shortTitle: '鞋服箱包',
    title: '服饰 / 鞋包 / 配件',
    icon: 'fashion',
    rows: [
      { label: '服饰', items: ['卫衣', '外套', 'T恤', '长裙'] },
      { label: '鞋子', items: ['球鞋', '拖鞋', '板鞋', '凉鞋'] },
      { label: '箱包', items: ['双肩包', '斜挎包', '帽子', '手表'] }
    ]
  },
  {
    shortTitle: '运动出行',
    title: '运动 / 骑行 / 代步',
    icon: 'travel',
    rows: [
      { label: '运动', items: ['羽毛球拍', '护腕', '瑜伽垫', '哑铃'] },
      { label: '骑行', items: ['自行车', '头盔', '车锁', '打气筒'] },
      { label: '乐器', items: ['吉他', '尤克里里', '琴包', '谱架'] }
    ]
  },
  {
    shortTitle: '美妆个护',
    title: '护肤 / 美妆 / 个护',
    icon: 'beauty',
    rows: [
      { label: '护肤', items: ['面霜', '防晒', '身体乳', '面膜'] },
      { label: '美妆', items: ['粉底', '口红', '眉笔', '腮红'] },
      { label: '个护', items: ['电动牙刷', '剃须刀', '卷发器', '香薰'] }
    ]
  },
  {
    shortTitle: '办公文具',
    title: '文具 / 办公 / 打印',
    icon: 'office',
    rows: [
      { label: '文具', items: ['活页本', '中性笔', '订书机', '便利贴'] },
      { label: '办公', items: ['打印机', 'U盘', '鼠标垫', '文件袋'] },
      { label: '学习桌', items: ['桌垫', '增高架', '收线器', '显示器支架'] }
    ]
  },
  {
    shortTitle: '卡券票务',
    title: '卡券 / 票券 / 月卡',
    icon: 'ticket',
    rows: [
      { label: '卡券', items: ['打印券', '咖啡券', '超市卡', '洗衣卡'] },
      { label: '票券', items: ['电影票', '演出票', '校车票', '活动票'] },
      { label: '服务', items: ['健身月卡', '理发券', '自习室券', '代金券'] }
    ]
  },
  {
    shortTitle: '兴趣文娱',
    title: '乐器 / 周边 / 收藏',
    icon: 'fun',
    rows: [
      { label: '乐器', items: ['吉他', '尤克里里', '谱架', '调音器'] },
      { label: '周边', items: ['徽章', '手办', '贴纸', '海报'] },
      { label: '娱乐', items: ['桌游', '主机游戏', '漫画', '杂志'] }
    ]
  },
  {
    shortTitle: '其他',
    title: '免费送 / 交换 / 拼单',
    icon: 'other',
    rows: [
      { label: '免费送', items: ['自提免费', '顺手带走', '宿舍清理', '毕业送'] },
      { label: '交换', items: ['以物换物', '教材互换', '卡券互换', '宿舍用品互换'] },
      { label: '拼单', items: ['零食拼单', '日用品拼单', '打印拼单', '快递凑单'] }
    ]
  }
];
