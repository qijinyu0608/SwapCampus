import { CampusServiceCategory, CampusServiceStatus, PrismaClient, ProductStatus, UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

const categories = ['教材', '数码', '生活用品', '运动器材', '宿舍好物', '自行车', '文具', '小家电', '鞋服', '考研资料'] as const;
const conditions = ['95新', '9成新', '8成新'] as const;
const colleges = ['林学院', '园林学院', '生物科学与技术学院', '工学院', '材料科学与技术学院', '经济管理学院', '草业与草原学院', '水土保持学院', '自然保护学院', '人文社会科学学院', '外语学院', '理学院'];
const meetupSpots = [
  '图书馆',
  '学一食堂',
  '学二食堂',
  '学三食堂',
  '学研中心A座',
  '学研中心B座',
  '主楼',
  '信息楼',
  '行政办公楼',
  '13号公寓',
  '11号公寓',
  '东门',
  '西门',
  '南门',
  '东北门',
  '银杏大道',
  '樱花大道',
  '田家炳体育馆',
  '中心草坪',
  '学生活动中心'
] as const;
const urgencyNotes = ['今天可取', '周内急出', '下课后可碰面', '支持当面验货', '毕业前清掉', '价格可小刀', '今晚顺路带到图书馆', '可约学研中心A座', '中午食堂顺路'];
const userNames = ['林舟', '许晴', '周砚', '陈诺', '沈一', '吴嘉', '赵川', '郑宁', '宋禾', '唐悦', '顾行', '何栖', '黎安', '冯可', '韩沐', '陆晨', '高言', '梁夏', '谢桥', '邵宁', '叶澄', '贺川', '白露', '程潇', '苏谨', '莫言', '余秋', '夏沐', '温岚', '季闻'];
const DEFAULT_ADMIN_PASSWORD = 'SwapCampusAdmin2026';
const DEFAULT_USER_PASSWORD = 'SwapCampusUser2026';
const DEMO_USER_EMAIL = 'qjinyu0608@qq.com';
const DEMO_USER_PASSWORD = '123456';

const imagePoolByCategory: Record<(typeof categories)[number], string[]> = {
  教材: ['/images/products/books-1.jpg', '/images/products/books-2.jpg'],
  数码: ['/images/products/keyboard.jpg', '/images/products/powerbank.png'],
  生活用品: ['/images/products/clothing-rack.jpg', '/images/products/storage-shelf.jpg', '/images/products/plush.jpg'],
  运动器材: ['/images/products/badminton.jpg'],
  宿舍好物: ['/images/products/lamp.jpg', '/images/products/fan.jpg', '/images/products/storage-shelf.jpg'],
  自行车: ['/images/products/badminton.jpg', '/images/products/storage-shelf.jpg'],
  文具: ['/images/products/books-1.jpg', '/images/products/books-2.jpg'],
  小家电: ['/images/products/fan.jpg', '/images/products/lamp.jpg'],
  鞋服: ['/images/products/clothing-rack.jpg', '/images/products/plush.jpg'],
  考研资料: ['/images/products/books-2.jpg', '/images/products/books-1.jpg']
};

function resolveImagesByTitle(category: (typeof categories)[number], title: string) {
  if (/(教材|真题|笔记|复习|英语|数学|专业课|活页本|荧光笔|计算器|资料)/.test(title)) {
    return ['/images/products/books-1.jpg', '/images/products/books-2.jpg'];
  }

  if (/(键盘)/.test(title)) {
    return ['/images/products/keyboard.jpg'];
  }

  if (/(充电宝|电源)/.test(title)) {
    return ['/images/products/powerbank.png'];
  }

  if (/(台灯|阅读灯|夜灯)/.test(title)) {
    return ['/images/products/lamp.jpg'];
  }

  if (/(风扇)/.test(title)) {
    return ['/images/products/fan.jpg'];
  }

  if (/(羽毛球|跳绳|护腕|头盔|骑行)/.test(title)) {
    return ['/images/products/badminton.jpg'];
  }

  if (/(衣架|衣篮|衣服|外套|卫衣|鞋|拖鞋|双肩包)/.test(title)) {
    return ['/images/products/clothing-rack.jpg'];
  }

  if (/(收纳|置物|推车|文件架|小桌|书桌)/.test(title)) {
    return ['/images/products/storage-shelf.jpg'];
  }

  if (/(靠垫|毛绒)/.test(title)) {
    return ['/images/products/plush.jpg'];
  }

  return imagePoolByCategory[category];
}

const productTemplates: Record<(typeof categories)[number], Array<{ title: string; description: string; price: number; tags: string[] }>> = {
  教材: [
    { title: '高等数学同济版上下册', description: '大一学完一直放寝室，里面只有少量重点标记，适合直接接着复习。', price: 28, tags: ['教材', '期末', '低价'] },
    { title: '考研英语黄皮书近十年真题', description: '去年备考用过，作文页有便签，其他都比较干净。', price: 36, tags: ['考研', '英语', '真题'] },
    { title: '408专业课笔记一整套', description: '按章节整理过，复习周拿去背效率比较高。', price: 42, tags: ['专业课', '笔记', '冲刺'] },
    { title: '四六级高频词书', description: '背了前半本，书角有点卷，不影响继续用。', price: 12, tags: ['四六级', '词汇', '随身'] },
    { title: '线性代数教材+习题册', description: '配套习题册一起带走，答案页完整。', price: 22, tags: ['线代', '教材', '习题'] }
  ],
  数码: [
    { title: '罗技机械键盘 K 系列', description: '轴体手感正常，灯效和接口都没问题，宿舍可直接试。', price: 118, tags: ['数码', '键盘', '可验货'] },
    { title: '10000mAh 快充充电宝', description: '平时只在图书馆备用，电池状态正常，支持现场试充。', price: 45, tags: ['充电宝', '快充', '配件齐'] },
    { title: '宿舍外接键盘 87 键', description: '换设备后闲置，敲字和打游戏都还顺手。', price: 66, tags: ['键盘', '低价', '宿舍'] },
    { title: '平板支架+收纳套装', description: '买来上网课用过一阵，铰链稳，没有明显松动。', price: 29, tags: ['平板', '支架', '居家'] },
    { title: '移动电源双口版', description: '线和本体一起出，夜里自习回寝路上拿很方便。', price: 39, tags: ['电源', '双口', '便携'] }
  ],
  生活用品: [
    { title: '落地衣架带底盘', description: '换宿舍后尺寸不合适，挂冬天外套也够稳。', price: 35, tags: ['衣架', '宿舍', '可面交'] },
    { title: '三层收纳架', description: '放零食和洗漱用品都很合适，已经擦干净。', price: 27, tags: ['收纳', '生活', '同校'] },
    { title: '毛绒靠垫', description: '放椅子上用过几次，手感还挺软，女生宿舍拿得多。', price: 18, tags: ['靠垫', '舒适', '宿舍'] },
    { title: '折叠脏衣篮', description: '可直接折起来带走，搬寝室不用占地方。', price: 14, tags: ['折叠', '好拿走', '生活'] },
    { title: '床边小推车', description: '滑轮顺畅，适合放水杯和纸巾，不想留着了。', price: 24, tags: ['推车', '轻便', '整理'] }
  ],
  运动器材: [
    { title: '羽毛球拍 2 支装', description: '社团活动后基本没再打，拍线状态正常。', price: 58, tags: ['羽毛球', '运动', '可小刀'] },
    { title: '瑜伽垫加厚款', description: '只有开学健身用过几次，收起来一直放柜子里。', price: 32, tags: ['瑜伽', '加厚', '同校'] },
    { title: '跳绳计数版', description: '体育课结束后闲置，计数器正常。', price: 15, tags: ['跳绳', '低价', '轻便'] },
    { title: '护腕一对', description: '跑步时戴过，清洗过后一直没再用。', price: 11, tags: ['护腕', '运动', '便宜'] },
    { title: '羽毛球训练桶球', description: '还剩不少，社团退坑一起转。', price: 26, tags: ['训练', '球类', '社团'] }
  ],
  宿舍好物: [
    { title: '护眼宿舍台灯', description: '亮度和色温都正常，期末周自习用着很稳。', price: 43, tags: ['台灯', '宿舍', '护眼'] },
    { title: '非充电台灯备用款', description: '插电使用，亮度正常，适合书桌晚自习。', price: 19, tags: ['非充电台灯', '宿舍', '白名单'] },
    { title: '床上折叠书桌', description: '看剧写作业都够用，桌脚没有晃。', price: 31, tags: ['书桌', '折叠', '宿舍'] },
    { title: '桌面阅读灯', description: '夹在书架边上很方便，光线均匀。', price: 25, tags: ['阅读灯', '学习', '夜间'] },
    { title: '收纳篮组合', description: '适合桌面和柜子一起整理，搬寝不想带走。', price: 16, tags: ['收纳', '组合', '低价'] }
  ],
  自行车: [
    { title: '山地车头盔', description: '平时骑车去教学楼戴过，内衬干净，没有磕碰。', price: 48, tags: ['自行车', '头盔', '通勤'] },
    { title: '单车码表', description: '社团骑行之后一直没再用，功能正常。', price: 35, tags: ['骑行', '码表', '配件'] },
    { title: '自行车尾灯', description: '夜骑备用，充电接口正常，亮度够用。', price: 22, tags: ['尾灯', '夜骑', '低价'] },
    { title: '便携打气筒', description: '放车篮里很方便，搬校区不想带走。', price: 18, tags: ['打气筒', '便携', '通勤'] },
    { title: 'U 型车锁', description: '锁芯正常，带两把钥匙，适合校园短停。', price: 29, tags: ['车锁', '安全', '校园'] }
  ],
  文具: [
    { title: '卡西欧函数计算器', description: '备考时用过，按键都正常，屏幕清晰。', price: 55, tags: ['计算器', '考试', '学习'] },
    { title: '活页本一套', description: '买多了没用完，内页和分隔页一起带。', price: 14, tags: ['活页本', '文具', '全新'] },
    { title: '荧光笔 6 色', description: '只拆了两支，其他基本没动。', price: 12, tags: ['荧光笔', '复习', '便宜'] },
    { title: '桌面文件架', description: '放讲义和作业挺方便，状态还可以。', price: 19, tags: ['文件架', '桌面', '整理'] },
    { title: '考试文具袋', description: '铅笔橡皮一起出，适合下学期继续用。', price: 10, tags: ['文具袋', '考试', '打包'] }
  ],
  小家电: [
    { title: '电动牙刷替换套装', description: '主机和充电座都正常，刷头会换新一起给。', price: 39, tags: ['电动牙刷', '宿舍白名单', '个护'] },
    { title: '电动剃须刀便携款', description: '自用闲置，续航正常，已经清理干净。', price: 27, tags: ['电动剃须刀', '便携', '宿舍白名单'] },
    { title: '20000mAh 以下充电宝', description: '容量 10000mAh，双口输出正常，图书馆自习备用很方便。', price: 42, tags: ['充电宝', '10000mAh', '白名单'] },
    { title: '非充电台灯插电款', description: '插电使用，亮度稳定，适合宿舍书桌。', price: 16, tags: ['非充电台灯', '学习', '低价'] },
    { title: '二手相机入门套机', description: '机身和镜头功能正常，适合课程拍摄和社团活动。', price: 210, tags: ['相机', '数码', '白名单'] }
  ],
  鞋服: [
    { title: '运动外套 M 码', description: '秋季上课穿过几次，洗净后一直放柜子里。', price: 36, tags: ['外套', 'M码', '学生自穿'] },
    { title: '帆布鞋 39 码', description: '款式还行，就是现在不太穿了。', price: 44, tags: ['鞋子', '39码', '日常'] },
    { title: '双肩包通勤款', description: '电脑层完好，背带没问题，适合上课背。', price: 58, tags: ['双肩包', '通勤', '电脑'] },
    { title: '卫衣 L 码', description: '宽松版型，成色如图，没有明显破损。', price: 32, tags: ['卫衣', 'L码', '闲置'] },
    { title: '宿舍拖鞋', description: '买大了没怎么穿，便宜出了。', price: 9, tags: ['拖鞋', '便宜', '宿舍'] }
  ],
  考研资料: [
    { title: '考研政治肖四肖八', description: '当季资料，题目完整，划线不多。', price: 26, tags: ['考研政治', '冲刺', '资料'] },
    { title: '考研数学复习全书', description: '章节索引贴了便签，查题很方便。', price: 33, tags: ['考研数学', '复习', '教材'] },
    { title: '英语作文模板笔记', description: '自己整理的高频模板，适合后期背诵。', price: 18, tags: ['英语', '作文', '笔记'] },
    { title: '专业课真题打印版', description: '按年份分装好了，拿去直接刷题就行。', price: 24, tags: ['专业课', '真题', '打印'] },
    { title: '考研倒计时计划本', description: '买多了一本，基本全新。', price: 11, tags: ['计划本', '全新', '备考'] }
  ]
};

function pickTemplate(category: (typeof categories)[number], index: number) {
  const list = productTemplates[category];
  const round = Math.floor(index / categories.length);
  return list[round % list.length];
}

function pickImages(category: (typeof categories)[number], index: number) {
  const list = imagePoolByCategory[category];
  return Array.from({ length: Math.min(3, list.length) }).map((_, offset) => list[(index + offset) % list.length]);
}

async function main() {
  await prisma.report.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.review.deleteMany();
  await prisma.order.deleteMany();
  await prisma.campusServiceTask.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.studentVerification.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      studentId: '2026000001',
      name: '平台管理员',
      email: 'admin@swapcampus.cn',
      passwordHash: hashSync(DEFAULT_ADMIN_PASSWORD, 10),
      role: UserRole.ADMIN,
      creditScore: 100,
      isVerified: true,
      verification: {
        create: {
          realName: '平台管理员',
          college: '林学院',
          phone: '18800000001',
          status: 'APPROVED'
        }
      }
    }
  });

  const users = await Promise.all(
    userNames.map((name, index) =>
      prisma.user.create({
        data: {
          studentId: `2026${String(index + 1001).padStart(6, '0')}`,
          name,
          email: `user${index + 1}@stu.swapcampus.cn`,
          passwordHash: hashSync(DEFAULT_USER_PASSWORD, 10),
          role: UserRole.USER,
          creditScore: 68 + (index % 27),
          isVerified: true,
          verification: {
            create: {
              realName: name,
              college: colleges[index % colleges.length],
              phone: `1880000${String(index).padStart(4, '0')}`,
              status: 'APPROVED'
            }
          }
        }
      })
    )
  );

  await prisma.user.create({
    data: {
      studentId: '2026990608',
      name: 'QJinyu',
      email: DEMO_USER_EMAIL,
      passwordHash: hashSync(DEMO_USER_PASSWORD, 10),
      role: UserRole.USER,
      creditScore: 88,
      isVerified: true,
      verification: {
        create: {
          realName: 'QJinyu',
          college: '工学院',
          phone: '18800000608',
          status: 'APPROVED'
        }
      }
    }
  });

  const sellers = [admin, ...users.filter((_, index) => index % 2 === 0)];
  const products = [];

  for (let index = 0; index < 360; index += 1) {
    const seller = sellers[index % sellers.length];
    const category = categories[index % categories.length];
    const template = pickTemplate(category, index);
    const meetup = meetupSpots[index % meetupSpots.length];
    const urgency = urgencyNotes[index % urgencyNotes.length];
    const condition = conditions[index % conditions.length];
    const title = index % 4 === 0 ? `${template.title} ${condition}` : template.title;

    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        title,
        description: `${template.description}${urgency}，约在${meetup}见面更方便。`,
        price: template.price + (index % 7),
        category,
        condition,
        tags: [...template.tags, urgency.replace('，', ''), meetup].join(','),
        status: index % 11 === 0 ? ProductStatus.PENDING : ProductStatus.ON_SALE
      }
    });

    products.push(product);

    await prisma.productImage.createMany({
      data: resolveImagesByTitle(category, title).map((imageUrl, sortOrder) => ({
        productId: product.id,
        imageUrl,
        sortOrder
      }))
    });
  }

  const orderSeedCount = Math.min(36, users.length, products.length);

  for (let index = 0; index < orderSeedCount; index += 1) {
    const product = products[index];
    const sellerId = product.sellerId;
    const buyer = users.find((candidate, candidateIndex) => candidateIndex >= index && candidate.id !== sellerId)
      ?? users.find((candidate) => candidate.id !== sellerId)
      ?? users[index];
    const meetup = meetupSpots[index % meetupSpots.length];

    const order = await prisma.order.create({
      data: {
        productId: product.id,
        buyerId: buyer.id,
        sellerId,
        status: index % 3 === 0 ? 'COMPLETED' : 'IN_PROGRESS',
        meetupLocation: meetup,
        note: '可当面验货后交易'
      }
    });

    const conversation = await prisma.conversation.create({
      data: {
        orderId: order.id,
        productId: product.id
      }
    });

    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          senderId: buyer.id,
          content: `这件${product.title}还在吗？我今天晚上可以去${meetup}。`
        },
        {
          conversationId: conversation.id,
          senderId: sellerId,
          content: '还在，可以当面看看再决定要不要。'
        }
      ]
    });
  }

  const campusServiceSeeds = [
    {
      title: '西门代取快递 2 件',
      category: CampusServiceCategory.ERRAND,
      description: '两件都是小件，顺路带到 13号公寓楼下即可。',
      reward: 5,
      locationFrom: '西门',
      locationTo: '13号公寓',
      deadlineLabel: '15 分钟内',
      estimatedMinutes: 18,
      publisherId: users[0].id,
      accepterId: users[3].id,
      status: CampusServiceStatus.MATCHED
    },
    {
      title: '今晚帮打印课程设计封面',
      category: CampusServiceCategory.AGENCY,
      description: '双面黑白 8 页，打印后放到学研中心A座门口。',
      reward: 6,
      locationFrom: '学研中心B座',
      locationTo: '学研中心A座',
      deadlineLabel: '20:30 前',
      estimatedMinutes: 24,
      publisherId: users[1].id,
      accepterId: null,
      status: CampusServiceStatus.OPEN
    },
    {
      title: '学一食堂带饭到图书馆',
      category: CampusServiceCategory.GROUP_BUY,
      description: '鸡排饭一份，18:10 前送到图书馆门口。',
      reward: 4,
      locationFrom: '学一食堂',
      locationTo: '图书馆',
      deadlineLabel: '约 18:10 送达',
      estimatedMinutes: 16,
      publisherId: users[2].id,
      accepterId: users[4].id,
      status: CampusServiceStatus.DONE
    },
    {
      title: '毕业季搬宿舍小件 2 箱',
      category: CampusServiceCategory.HELP,
      description: '从 6号公寓搬到 13号公寓，有小推车更方便。',
      reward: 18,
      locationFrom: '6号公寓',
      locationTo: '13号公寓',
      deadlineLabel: '周末可接',
      estimatedMinutes: 40,
      publisherId: users[5].id,
      accepterId: null,
      status: CampusServiceStatus.OPEN
    },
    {
      title: '主楼资料送到行政办公楼',
      category: CampusServiceCategory.AGENCY,
      description: '课程材料已装袋，送到行政办公楼前台即可。',
      reward: 7,
      locationFrom: '主楼',
      locationTo: '行政办公楼',
      deadlineLabel: '下午 16:00 前',
      estimatedMinutes: 20,
      publisherId: users[6].id,
      accepterId: users[7].id,
      status: CampusServiceStatus.MATCHED
    },
    {
      title: '田家炳体育馆顺路带水到11号公寓',
      category: CampusServiceCategory.ERRAND,
      description: '一箱矿泉水，电梯可上楼，顺路帮忙放到楼下就行。',
      reward: 8,
      locationFrom: '田家炳体育馆',
      locationTo: '11号公寓',
      deadlineLabel: '今晚 21:00 前',
      estimatedMinutes: 22,
      publisherId: users[8].id,
      accepterId: null,
      status: CampusServiceStatus.OPEN
    },
    {
      title: '学二食堂拼单奶茶送到学研中心C座',
      category: CampusServiceCategory.GROUP_BUY,
      description: '三杯奶茶一起下单，到了后放一楼大厅联系。',
      reward: 3,
      locationFrom: '学二食堂',
      locationTo: '学研中心C座',
      deadlineLabel: '17:40 前',
      estimatedMinutes: 15,
      publisherId: users[9].id,
      accepterId: users[10].id,
      status: CampusServiceStatus.DONE
    },
    {
      title: '东门代拿材料送到信息楼',
      category: CampusServiceCategory.HELP,
      description: '文件袋一份，帮忙从东门拿到信息楼老师办公室。',
      reward: 6,
      locationFrom: '东门',
      locationTo: '信息楼',
      deadlineLabel: '今天 14:30 前',
      estimatedMinutes: 18,
      publisherId: users[11].id,
      accepterId: null,
      status: CampusServiceStatus.OPEN
    }
  ];

  for (const [index, taskSeed] of campusServiceSeeds.entries()) {
    const task = await prisma.campusServiceTask.create({
      data: taskSeed
    });

    if (!taskSeed.accepterId) {
      continue;
    }

    const conversation = await prisma.conversation.create({
      data: {
        campusServiceTaskId: task.id
      }
    });

    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          senderId: taskSeed.accepterId,
          content: index % 2 === 0 ? `我可以接“${task.title}”，你现在方便对接吗？` : `我这边可以处理“${task.title}”，细节发我一下。`
        },
        {
          conversationId: conversation.id,
          senderId: taskSeed.publisherId,
          content: '可以，站内聊细节就行。'
        }
      ]
    });
  }

  await prisma.report.createMany({
    data: [
      {
        reporterId: users[0].id,
        productId: products[3].id,
        reason: '商品描述与实际成色可能不一致',
        status: 'OPEN'
      },
      {
        reporterId: users[1].id,
        productId: products[7].id,
        reason: '疑似重复发布同类商品',
        status: 'OPEN'
      },
      {
        reporterId: users[2].id,
        targetUserId: users[5].id,
        reason: '聊天时多次催促站外转账',
        status: 'RESOLVED',
        handledBy: admin.id,
        resolutionNote: '已提醒并记录，后续继续观察'
      }
    ]
  });

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: admin.id,
        actorName: '平台管理员',
        action: 'REVIEW_PRODUCT',
        targetType: 'PRODUCT',
        targetId: products[0].id,
        detail: '首批商品内容校验通过并上架'
      },
      {
        actorId: admin.id,
        actorName: '平台管理员',
        action: 'RESOLVE_REPORT',
        targetType: 'REPORT_USER',
        targetId: users[5].id,
        detail: '提醒卖家站内沟通并保留留痕'
      }
    ]
  });

  console.log('Seed completed with products, orders, and campus services.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
