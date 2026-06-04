import { Input, Skeleton } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FoldSection } from '../components/FoldSection';
import { getBjfuMeetupLabel } from '../constants/campus';
import { fetchProducts, fetchRecommendations, ProductSummary } from '../services/api';
import { getBehaviorProfile, subscribeBehavior } from '../services/behavior';
import { getDemoUser } from '../services/session';
import { getProductImage } from '../utils/productCover';

const shortcutGroups = [
  {
    shortTitle: '手机数码',
    title: '手机 / 数码 / 电脑',
    badge: '热',
    rows: [
      { label: '手机', items: ['iPhone', '安卓机', '备用机', '手机壳'] },
      { label: '电脑', items: ['笔记本', '显示器', '键盘', '鼠标'] },
      { label: '数码', items: ['耳机', '平板', '相机', '充电宝'] }
    ]
  },
  {
    shortTitle: '教材资料',
    title: '教材 / 资料 / 文具',
    badge: '稳',
    rows: [
      { label: '教材', items: ['高数', '计网', '英语', '思政'] },
      { label: '考试', items: ['考研真题', '四六级', '期末资料', '网课笔记'] },
      { label: '文具', items: ['活页本', '计算器', '台历', '中性笔'] }
    ]
  },
  {
    shortTitle: '宿舍白名单',
    title: '宿舍 / 白名单电器 / 收纳',
    badge: '省',
    rows: [
      { label: '宿舍', items: ['折叠桌', '非充电台灯', '床帘', '靠垫'] },
      { label: '电器', items: ['电脑', '手机', '平板电脑', '充电宝'] },
      { label: '收纳', items: ['置物架', '收纳篮', '鞋架', '挂钩'] }
    ]
  },
  {
    shortTitle: '鞋服箱包',
    title: '服饰 / 鞋包 / 配件',
    badge: '新',
    rows: [
      { label: '服饰', items: ['卫衣', '外套', 'T恤', '长裙'] },
      { label: '鞋子', items: ['球鞋', '拖鞋', '板鞋', '凉鞋'] },
      { label: '包配', items: ['双肩包', '斜挎包', '帽子', '手表'] }
    ]
  },
  {
    shortTitle: '运动出行',
    title: '运动 / 自行车 / 乐器',
    badge: '逛',
    rows: [
      { label: '运动', items: ['羽毛球拍', '护腕', '瑜伽垫', '哑铃'] },
      { label: '代步', items: ['自行车', '头盔', '车锁', '打气筒'] },
      { label: '乐器', items: ['吉他', '尤克里里', '琴包', '谱架'] }
    ]
  },
  {
    shortTitle: '卡券周边',
    title: '卡券 / 票券 / 周边',
    badge: '快',
    rows: [
      { label: '卡券', items: ['打印券', '咖啡券', '超市卡', '洗衣卡'] },
      { label: '票券', items: ['电影票', '演出票', '校车票', '健身月卡'] },
      { label: '周边', items: ['校园徽章', '手办', '贴纸', '海报'] }
    ]
  },
  {
    shortTitle: '毕业急出',
    title: '毕业清仓 / 急出',
    badge: '同校',
    rows: [
      { label: '毕业清仓', items: ['打包出', '宿舍带不走', '低价急出', '整套转'] },
      { label: '今天可取', items: ['图书馆', '学一食堂', '东门', '13号公寓'] },
      { label: '省心购', items: ['可验货', '支持小刀', '先到先得', '同校自提'] }
    ]
  },
  {
    shortTitle: '考研考证',
    title: '考研 / 考证 / 用品',
    badge: '低价',
    rows: [
      { label: '考研', items: ['英语', '政治', '数学', '专业课'] },
      { label: '考证', items: ['教资', '计算机二级', '普通话', '法考'] },
      { label: '用品', items: ['计划本', '计时器', '书立', '台灯'] }
    ]
  },
  {
    shortTitle: '日用洗护',
    title: '生活 / 日用 / 洗护',
    badge: '常',
    rows: [
      { label: '日用', items: ['水杯', '垃圾桶', '晾衣架', '收纳箱'] },
      { label: '洗护', items: ['洗衣液', '香薰', '除湿盒', '粘毛器'] },
      { label: '家清', items: ['抽纸', '清洁刷', '桌面收纳', '抹布'] }
    ]
  },
  {
    shortTitle: '桌搭灯具',
    title: '桌搭 / 学习区 / 灯具',
    badge: '学',
    rows: [
      { label: '学习区', items: ['增高架', '书立', '坐垫', '计时器'] },
      { label: '灯具', items: ['护眼灯', '夹灯', '小夜灯', '台灯'] },
      { label: '桌搭', items: ['显示器支架', '桌垫', '收线器', '键盘托'] }
    ]
  },
  {
    shortTitle: '美妆个护',
    title: '美妆 / 护肤 / 个护',
    badge: '用',
    rows: [
      { label: '护肤', items: ['面霜', '防晒', '身体乳', '面膜'] },
      { label: '美妆', items: ['粉底', '口红', '眉笔', '腮红'] },
      { label: '个护', items: ['电动牙刷', '电动剃须刀', '剃须刀', '相机'] }
    ]
  },
  {
    shortTitle: '通勤办公',
    title: '通勤 / 实习 / 办公',
    badge: '实',
    rows: [
      { label: '通勤', items: ['保温杯', '背包', '雨伞', '充电线'] },
      { label: '办公', items: ['打印机', 'U盘', '订书机', '鼠标垫'] },
      { label: '实习', items: ['正装', '工牌夹', '文件袋', '便签纸'] }
    ]
  },
  {
    shortTitle: '交换免费',
    title: '免费送 / 交换 / 拼单',
    badge: '省',
    rows: [
      { label: '免费送', items: ['自提免费', '顺手带走', '宿舍清理', '毕业送'] },
      { label: '交换', items: ['以物换物', '教材互换', '卡券互换', '宿舍用品互换'] },
      { label: '拼单', items: ['零食拼单', '日用品拼单', '打印拼单', '快递凑单'] }
    ]
  }
];

const filterRows = {
  sort: ['综合排序', '最新发布', '价格最低', '信用优先', '离我最近'],
  price: ['不限', '20以下', '20-50', '50-100', '100以上'],
  condition: ['不限成色', '95新', '9成新', '8成新'],
  trade: ['全部方式', '同校面交', '公寓自提', '今天可取']
};

type SortFilter = (typeof filterRows.sort)[number];
type PriceFilter = (typeof filterRows.price)[number];
type ConditionFilter = (typeof filterRows.condition)[number];
type TradeFilter = (typeof filterRows.trade)[number];

const statusMap: Record<string, { label: string; color: string }> = {
  ON_SALE: { label: '在售', color: 'green' },
  PENDING: { label: '新上架', color: 'orange' },
  SOLD: { label: '已售', color: 'default' },
  OFFLINE: { label: '已下架', color: 'red' }
};

const visibleShortcutGroups = shortcutGroups;

export function HomePage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeSort, setActiveSort] = useState<SortFilter>('综合排序');
  const [activePrice, setActivePrice] = useState<PriceFilter>('不限');
  const [activeCondition, setActiveCondition] = useState<ConditionFilter>('不限成色');
  const [activeTrade, setActiveTrade] = useState<TradeFilter>('全部方式');
  const [activeShortcutGroup, setActiveShortcutGroup] = useState<string | null>(null);
  const [behaviorVersion, setBehaviorVersion] = useState(0);

  const currentUser = useMemo(() => getDemoUser(), []);
  const behaviorProfile = useMemo(
    () => getBehaviorProfile(currentUser),
    [currentUser, behaviorVersion]
  );

  useEffect(() => {
    async function load() {
      try {
        const demoUser = getDemoUser();
        const productsData = demoUser
          ? await fetchRecommendations(demoUser.id)
          : await fetchProducts();
        setProducts(productsData);
      } catch {
        setProducts([
          {
            id: 1,
            title: '机械键盘 95新',
            category: '数码',
            price: 18,
            condition: '9成新',
            tags: ['键盘', '低价', '同校'],
            status: 'ON_SALE',
            description: '13号公寓自提，图书馆附近可面交。',
            sellerName: '张三',
            imageUrl: '/images/products/keyboard.jpg'
          }
        ]);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => subscribeBehavior(() => setBehaviorVersion((value) => value + 1)), []);

  function applyKeywordFilter(keyword: string) {
    setSearchKeyword(keyword);
  }

  const recommendedProducts = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    const filtered = products.filter((item) => {
      const matchesKeyword = !keyword || [item.title, item.description, item.category, item.sellerName, ...item.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);

      const matchesPrice = activePrice === '不限'
        ? true
        : activePrice === '20以下'
          ? item.price < 20
          : activePrice === '20-50'
            ? item.price >= 20 && item.price <= 50
            : activePrice === '50-100'
              ? item.price > 50 && item.price <= 100
              : item.price > 100;

      const matchesCondition = activeCondition === '不限成色' || item.condition === activeCondition;

      const matchesTrade = activeTrade === '全部方式'
        ? true
        : activeTrade === '同校面交'
          ? true
          : activeTrade === '公寓自提'
          ? /公寓/.test(item.description)
          : /今天|今晚|急出|可取/.test(item.description) || item.tags.some((tag) => /今天|今晚/.test(tag));

      return matchesKeyword && matchesPrice && matchesCondition && matchesTrade;
    });

    const ranked = [...filtered];
    if (activeSort === '综合排序') {
      ranked
        .map((item, index) => {
          const categoryScore = behaviorProfile.categoryWeights[item.category] ?? 0;
          const tagScore = item.tags.reduce((sum, tag) => sum + (behaviorProfile.tagWeights[tag] ?? 0), 0);
          const favoriteBoost = behaviorProfile.favoriteProductIds.includes(item.id) ? 28 : 0;
          const viewedBoost = behaviorProfile.viewedProductIds.includes(item.id) ? 10 : 0;
          const trustBoost = Math.round((item.sellerCreditScore ?? 60) / 10);
          const freshnessBoost = Math.max(0, 18 - index / 2);

          return {
            item,
            score: categoryScore + tagScore + favoriteBoost + viewedBoost + trustBoost + freshnessBoost
          };
        })
        .sort((left, right) => right.score - left.score)
        .forEach((entry, index) => {
          ranked[index] = entry.item;
        });
    } else if (activeSort === '价格最低') {
      ranked.sort((a, b) => a.price - b.price);
    } else if (activeSort === '信用优先') {
      ranked.sort((a, b) => (b.sellerCreditScore ?? 60) - (a.sellerCreditScore ?? 60));
    } else if (activeSort === '离我最近') {
      ranked.sort((a, b) => Number(/图书馆|学一食堂/.test(a.description)) - Number(/图书馆|学一食堂/.test(b.description)));
      ranked.reverse();
    }

    return ranked.slice(0, 32);
  }, [products, searchKeyword, activeSort, activePrice, activeCondition, activeTrade, behaviorProfile]);
  const activeShortcutPanel = useMemo(
    () => shortcutGroups.find((item) => item.title === activeShortcutGroup) ?? null,
    [activeShortcutGroup]
  );
  const activityScene = useMemo(() => {
    const source = recommendedProducts.length ? recommendedProducts : products;
    const fallbackItems = source.slice(0, 2);
    const pickItems = (terms: string[], count: number) => {
      const matched = source.filter((item) => {
        const haystack = [item.title, item.description, item.category, item.sellerName, ...item.tags]
          .filter(Boolean)
          .join(' ');
        return terms.some((term) => haystack.includes(term));
      });

      return (matched.length ? matched : fallbackItems).slice(0, count);
    };

    return {
      lead: {
        title: activeShortcutPanel?.shortTitle ?? '毕业季清仓',
        subtitle: activeShortcutPanel
          ? activeShortcutPanel.rows.slice(0, 2).map((row) => row.label).join(' · ')
          : '13号公寓搬迁 · 图书馆可取',
        pills: activeShortcutPanel
          ? [...activeShortcutPanel.rows.slice(0, 2).map((row) => row.label), '同校面交']
          : ['毕业清仓', '图书馆可取', '同校面交'],
        items: activeShortcutPanel
          ? pickItems(activeShortcutPanel.rows.flatMap((row) => [row.label, ...row.items]), 2)
          : pickItems(['毕业', '急出', '图书馆', '13号公寓'], 2)
      },
      cards: [
        {
          title: '下学期教材',
          subtitle: '图书馆 / 学研A',
          keyword: '教材',
          tone: 'sun',
          items: pickItems(['教材', '资料', '文具'], 2)
        },
        {
          title: '宿舍换新',
          subtitle: '13号公寓 / 白名单',
          keyword: '宿舍',
          tone: 'mint',
          items: pickItems(['宿舍', '白名单', '收纳', '台灯'], 2)
        },
        {
          title: '今天面交',
          subtitle: '学一食堂 / 东门',
          keyword: '图书馆',
          tone: 'sky',
          items: pickItems(['图书馆', '学一食堂', '东门', '急出'], 2)
        },
        {
          title: '数码捡漏',
          subtitle: '信息楼 / 图书馆',
          keyword: '数码',
          tone: 'peach',
          items: pickItems(['数码', '耳机', '电脑', '平板'], 2)
        }
      ]
    };
  }, [activeShortcutPanel, products, recommendedProducts]);
  const filterSummary = [activeSort, activePrice, activeTrade].filter((item) => item && item !== '不限' && item !== '全部方式');
  const leadPrimaryItem = activityScene.lead.items[0] ?? null;
  const leadSecondaryItem = activityScene.lead.items[1] ?? null;

  return (
    <div className="fish-home">
      <section className="fish-search-shell">
        <div className="fish-search-row">
          <div className="fish-search-box">
            <Input
              size="large"
              prefix={<SearchOutlined />}
              placeholder="搜索手机、电脑、教材、卡券"
              bordered={false}
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
            />
            <button type="button" className="fish-search-button">搜索</button>
          </div>
        </div>
      </section>

      <section className="fish-market-layout" onMouseLeave={() => setActiveShortcutGroup(null)}>
        <section className="fish-market-category-block">
          <div className="fish-market-category-head">
            <strong>分类</strong>
            {activeShortcutPanel ? <span>{activeShortcutPanel.title}</span> : null}
          </div>
          <div className="fish-category-panel">
            {visibleShortcutGroups.map((item) => (
              <button
                key={item.title}
                type="button"
                className={activeShortcutGroup === item.title ? 'fish-category-row active' : 'fish-category-row'}
                onMouseEnter={() => setActiveShortcutGroup(item.title)}
                onFocus={() => setActiveShortcutGroup(item.title)}
                onClick={() => setActiveShortcutGroup((value) => (value === item.title ? null : item.title))}
              >
                <span className="fish-category-badge">{item.badge}</span>
                <div className="fish-category-copy">
                  <strong>{item.shortTitle}</strong>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="fish-market-activity">
          {activeShortcutPanel ? (
            <div className="fish-market-detail-stage">
              <div className="fish-category-detail-panel">
                {activeShortcutPanel.rows.map((row) => (
                  <div key={row.label} className="fish-category-detail-row">
                    <button
                      type="button"
                      className="fish-category-detail-label"
                      onClick={() => applyKeywordFilter(row.label)}
                    >
                      {row.label}
                    </button>
                    <div className="fish-category-detail-items">
                      {row.items.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="fish-category-detail-item"
                          onClick={() => applyKeywordFilter(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="fish-market-activity-stage">
              <div className="fish-activity-grid">
                <div
                  className="fish-activity-hero-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => applyKeywordFilter(activityScene.lead.title)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      applyKeywordFilter(activityScene.lead.title);
                    }
                  }}
                >
                  <div className="fish-activity-hero-copy">
                    <span className="fish-activity-kicker">校园活动</span>
                    <strong>{activityScene.lead.title}</strong>
                    <p>{activityScene.lead.subtitle}</p>
                    <div className="fish-activity-hero-footer">
                      <div className="fish-activity-pills">
                        {activityScene.lead.pills.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                      <span className="fish-activity-hero-cta">去看看</span>
                    </div>
                  </div>
                  <div className="fish-activity-hero-preview">
                    {leadPrimaryItem ? (
                      <button
                        key={`lead-primary-${leadPrimaryItem.id}`}
                        type="button"
                        className="fish-activity-product feature"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/products/${leadPrimaryItem.id}`);
                        }}
                      >
                        <img src={getProductImage(leadPrimaryItem, 0)} alt={leadPrimaryItem.title} />
                        <div className="fish-activity-product-copy">
                          <strong>¥{leadPrimaryItem.price}</strong>
                          <span>{leadPrimaryItem.title}</span>
                        </div>
                      </button>
                    ) : null}
                    {leadSecondaryItem ? (
                      <button
                        key={`lead-secondary-${leadSecondaryItem.id}`}
                        type="button"
                        className="fish-activity-product slim"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/products/${leadSecondaryItem.id}`);
                        }}
                      >
                        <img src={getProductImage(leadSecondaryItem, 1)} alt={leadSecondaryItem.title} />
                        <div className="fish-activity-product-copy">
                          <strong>¥{leadSecondaryItem.price}</strong>
                          <span>{leadSecondaryItem.title}</span>
                        </div>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="fish-activity-card-grid">
                  {activityScene.cards.map((card) => (
                    <div
                      key={card.title}
                      className={`fish-activity-card tone-${card.tone}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => applyKeywordFilter(card.keyword)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          applyKeywordFilter(card.keyword);
                        }
                      }}
                    >
                      <div className="fish-activity-card-copy">
                        <strong>{card.title}</strong>
                        <span>{card.subtitle}</span>
                      </div>
                      <div className="fish-activity-card-items">
                        {card.items.map((item, index) => (
                          <button
                            key={`${card.title}-${item.id}-${index}`}
                            type="button"
                            className="fish-activity-mini-product"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/products/${item.id}`);
                            }}
                          >
                            <img src={getProductImage(item, index)} alt={item.title} />
                            <div className="fish-activity-mini-product-copy">
                              <strong>¥{item.price}</strong>
                              <span>{item.title}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </section>

      <section className="fish-feed-shell fish-feed-shell-home">
        <div className="fish-feed-header">
          <h2>推荐</h2>
        </div>

        <FoldSection
          title="筛选"
          meta={filterSummary.length ? filterSummary.join(' / ') : '展开筛选'}
          compact
        >
          <div className="fish-filter-panel">
            <div className="fish-filter-row">
              <span className="fish-filter-label">排序</span>
              {filterRows.sort.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={activeSort === item ? 'fish-filter-chip active' : 'fish-filter-chip'}
                  onClick={() => setActiveSort(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="fish-filter-row">
              <span className="fish-filter-label">价格</span>
              {filterRows.price.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={activePrice === item ? 'fish-filter-chip active' : 'fish-filter-chip'}
                  onClick={() => setActivePrice(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="fish-filter-row">
              <span className="fish-filter-label">成色</span>
              {filterRows.condition.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={activeCondition === item ? 'fish-filter-chip active' : 'fish-filter-chip'}
                  onClick={() => setActiveCondition(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="fish-filter-row">
              <span className="fish-filter-label">交易</span>
              {filterRows.trade.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={activeTrade === item ? 'fish-filter-chip active' : 'fish-filter-chip'}
                  onClick={() => setActiveTrade(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </FoldSection>

        {loading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : (
          <div className="fish-feed-grid">
            {recommendedProducts.map((item, index) => {
              const status = statusMap[item.status] ?? { label: item.status, color: 'default' };
              const meetupLabel = getBjfuMeetupLabel(index);
              const coverSignal = `${item.category} · ${item.condition}`;
              return (
                <article
                  key={item.id}
                  className={`fish-item-card ${index % 3 === 2 ? 'offset' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/products/${item.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      navigate(`/products/${item.id}`);
                    }
                  }}
                >
                  <div className={item.imageUrl ? 'fish-item-cover has-image' : 'fish-item-cover'}>
                    <img
                      className="fish-item-cover-image"
                      src={getProductImage(item, index)}
                      alt={item.title}
                    />
                    <span className="fish-item-signal">{coverSignal}</span>
                  </div>
                  <div className="fish-item-body">
                    <h3>{item.title}</h3>
                    <div className="fish-item-price-row">
                      <strong>¥{item.price}</strong>
                      {item.status !== 'ON_SALE' ? <span>{status.label}</span> : null}
                    </div>
                    <div className="fish-item-meta">
                      <span>{item.sellerName}</span>
                      <i />
                      <span>{meetupLabel}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
