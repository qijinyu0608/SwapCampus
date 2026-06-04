import { CampusServiceCategory, CampusServiceStatus, PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const targetOpenTaskCount = 10;

const openTaskTemplates: Array<{
  title: string;
  category: CampusServiceCategory;
  description: string;
  reward: number;
  locationFrom: string;
  locationTo: string;
  deadlineLabel: string;
  estimatedMinutes: number;
}> = [
  {
    title: '东门快递代取到13号公寓',
    category: CampusServiceCategory.ERRAND,
    description: '一件小快递，取件码已发，放到13号公寓楼下联系我即可。',
    reward: 5,
    locationFrom: '东门快递点',
    locationTo: '13号公寓',
    deadlineLabel: '今天 19:30 前',
    estimatedMinutes: 18
  },
  {
    title: '学研中心A座打印讲义送主楼',
    category: CampusServiceCategory.AGENCY,
    description: '黑白打印12页，打印后送到主楼一层大厅。',
    reward: 7,
    locationFrom: '学研中心A座',
    locationTo: '主楼',
    deadlineLabel: '今晚 20:00 前',
    estimatedMinutes: 24
  },
  {
    title: '学一食堂带饭到图书馆',
    category: CampusServiceCategory.GROUP_BUY,
    description: '米饭套餐一份，已经线上下单，取餐后送到图书馆北门。',
    reward: 4,
    locationFrom: '学一食堂',
    locationTo: '图书馆',
    deadlineLabel: '约 18:20 送达',
    estimatedMinutes: 16
  },
  {
    title: '6号公寓搬一箱书到11号公寓',
    category: CampusServiceCategory.HELP,
    description: '纸箱不重，有电梯，帮忙从楼下搬到11号公寓门口。',
    reward: 12,
    locationFrom: '6号公寓',
    locationTo: '11号公寓',
    deadlineLabel: '今晚 21:00 前',
    estimatedMinutes: 28
  },
  {
    title: '行政楼材料送到信息楼',
    category: CampusServiceCategory.AGENCY,
    description: '文件袋一份，送到信息楼一层值班室即可。',
    reward: 6,
    locationFrom: '行政楼',
    locationTo: '信息楼',
    deadlineLabel: '今天 16:30 前',
    estimatedMinutes: 20
  },
  {
    title: '西门取文件送学研中心B座',
    category: CampusServiceCategory.ERRAND,
    description: '文件袋已放门卫处，取到后送学研中心B座门口。',
    reward: 6,
    locationFrom: '西门',
    locationTo: '学研中心B座',
    deadlineLabel: '1 小时内',
    estimatedMinutes: 22
  },
  {
    title: '田家炳体育馆饮料带到11号公寓',
    category: CampusServiceCategory.GROUP_BUY,
    description: '顺路带两瓶饮料到11号公寓楼下，费用见面转。',
    reward: 3,
    locationFrom: '田家炳体育馆',
    locationTo: '11号公寓',
    deadlineLabel: '今晚 21:30 前',
    estimatedMinutes: 15
  },
  {
    title: '南门快递柜小件送到6号公寓',
    category: CampusServiceCategory.ERRAND,
    description: '一件小包裹，取件码已准备好，送到6号公寓楼下。',
    reward: 5,
    locationFrom: '南门快递柜',
    locationTo: '6号公寓',
    deadlineLabel: '今天 18:00 前',
    estimatedMinutes: 17
  },
  {
    title: '图书馆帮取预约资料',
    category: CampusServiceCategory.HELP,
    description: '资料在图书馆服务台，报姓名后取走，送到学研中心C座。',
    reward: 8,
    locationFrom: '图书馆',
    locationTo: '学研中心C座',
    deadlineLabel: '下午 17:20 前',
    estimatedMinutes: 25
  },
  {
    title: '学二食堂拼单咖啡送主楼',
    category: CampusServiceCategory.GROUP_BUY,
    description: '两杯咖啡一起取，送主楼门口后电话联系。',
    reward: 4,
    locationFrom: '学二食堂',
    locationTo: '主楼',
    deadlineLabel: '今天 15:40 前',
    estimatedMinutes: 14
  },
  {
    title: '信息楼帮交课程作业',
    category: CampusServiceCategory.AGENCY,
    description: '作业袋在13号公寓楼下，帮忙送到信息楼老师办公室。',
    reward: 9,
    locationFrom: '13号公寓',
    locationTo: '信息楼',
    deadlineLabel: '明天 10:00 前',
    estimatedMinutes: 30
  },
  {
    title: '操场看包20分钟',
    category: CampusServiceCategory.HELP,
    description: '跑步测试时帮忙看一下包，结束后当面取回。',
    reward: 6,
    locationFrom: '田家炳体育馆',
    locationTo: '田家炳体育馆',
    deadlineLabel: '今天 19:00 左右',
    estimatedMinutes: 20
  }
];

function looksLikeCurrentDemoUser(user: { name: string; studentId: string; email: string }) {
  const text = `${user.name} ${user.studentId} ${user.email}`.toLowerCase();
  return text.includes('qijinyu') || text.includes('qijnyu');
}

function buildAvailableTitle(baseTitle: string, existingTitles: Set<string>) {
  if (!existingTitles.has(baseTitle)) {
    return baseTitle;
  }

  for (let index = 2; index <= 20; index += 1) {
    const title = `${baseTitle} ${index}`;
    if (!existingTitles.has(title)) {
      return title;
    }
  }

  return `${baseTitle} ${Date.now()}`;
}

async function main() {
  const openTaskCount = await prisma.campusServiceTask.count({
    where: { status: CampusServiceStatus.OPEN }
  });

  if (openTaskCount >= targetOpenTaskCount) {
    console.log(`[db:ensure-campus-services] open campus services already available (${openTaskCount})`);
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      role: UserRole.USER,
      isBanned: false
    },
    orderBy: { id: 'asc' },
    select: { id: true, name: true, studentId: true, email: true }
  });

  const publishers = users.filter((user) => !looksLikeCurrentDemoUser(user));
  const publisherPool = publishers.length > 0 ? publishers : users;

  if (!publisherPool.length) {
    throw new Error('[db:ensure-campus-services] no available users found, cannot create campus services');
  }

  const existingTitles = new Set(
    (await prisma.campusServiceTask.findMany({
      select: { title: true }
    })).map((task) => task.title)
  );

  const missingCount = targetOpenTaskCount - openTaskCount;
  let createdCount = 0;

  for (let index = 0; createdCount < missingCount; index += 1) {
    if (createdCount >= missingCount) {
      break;
    }

    const template = openTaskTemplates[index % openTaskTemplates.length];
    const title = buildAvailableTitle(template.title, existingTitles);

    const publisher = publisherPool[createdCount % publisherPool.length];
    await prisma.campusServiceTask.create({
      data: {
        ...template,
        title,
        publisherId: publisher.id,
        accepterId: null,
        status: CampusServiceStatus.OPEN
      }
    });

    existingTitles.add(title);
    createdCount += 1;
    console.log(`[db:ensure-campus-services] created OPEN task: ${title} (publisher ${publisher.name})`);
  }

  console.log(`[db:ensure-campus-services] open campus services: ${openTaskCount} -> ${openTaskCount + createdCount}`);
}

main()
  .catch((error) => {
    console.error('[db:ensure-campus-services] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
