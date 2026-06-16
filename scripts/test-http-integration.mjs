#!/usr/bin/env node

const API_BASE_URL = process.env.SWAPCAMPUS_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
const LOGIN_ACCOUNT = process.env.SWAPCAMPUS_TEST_ACCOUNT ?? 'user';
const LOGIN_PASSWORD = process.env.SWAPCAMPUS_TEST_PASSWORD ?? 'user';
const CAMPUS_SERVICE_TEST_ACCOUNTS = [
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_0 ?? 'user',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_0 ?? 'user',
    intent: 'REQUEST',
    category: 'GROUP_BUY',
    title: `HTTP 集成主账号拼单 ${Date.now()}`,
    description: '中午一起拼一份轻食外卖，按人数平摊后统一下单。',
    priceMode: 'FIXED',
    amount: 1,
    locationNote: '群里确认后统一下单'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_1 ?? 'user01@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_1 ?? 'user01',
    intent: 'REQUEST',
    category: 'ERRAND',
    title: `HTTP 集成快递代取 ${Date.now()}`,
    description: '午间可帮忙代取东门快递。',
    priceMode: 'FIXED',
    amount: 6,
    locationNote: '东门快递柜'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_2 ?? 'user02@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_2 ?? 'user02',
    intent: 'REQUEST',
    category: 'MOVING',
    title: `HTTP 集成宿舍搬运 ${Date.now()}`,
    description: '今晚可帮忙搬一箱资料到隔壁楼。 ',
    priceMode: 'FIXED',
    amount: 12,
    locationNote: '一号楼到七号楼'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_4 ?? 'user08@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_4 ?? 'user08',
    intent: 'OFFER',
    category: 'HELP',
    title: `HTTP 集成临时帮忙 ${Date.now()}`,
    description: '晚间可顺路帮忙带饭或送资料。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '宿舍区私聊'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_5 ?? 'user03@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_5 ?? 'user03',
    intent: 'OFFER',
    category: 'TUTORING',
    title: `HTTP 集成高数辅导 ${Date.now()}`,
    description: '本周可线上辅导高数基础题型。',
    priceMode: 'FIXED',
    amount: 35,
    locationNote: '腾讯会议 / 站内消息约时间'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_6 ?? 'user04@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_6 ?? 'user04',
    intent: 'REQUEST',
    category: 'REPAIR',
    title: `HTTP 集成宿舍小修 ${Date.now()}`,
    description: '书桌灯安装需要一个十字螺丝刀。',
    priceMode: 'FIXED',
    amount: 18,
    locationNote: '8号宿舍楼一层'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_7 ?? 'user05@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_7 ?? 'user05',
    intent: 'OFFER',
    category: 'EVENT',
    title: `HTTP 集成活动搭子 ${Date.now()}`,
    description: '周末可一起跑步打卡或自习组队。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '操场 / 图书馆'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_7A ?? 'admin@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_7A ?? 'admin',
    intent: 'OFFER',
    category: 'EVENT',
    title: `HTTP 集成管理员活动引导 ${Date.now()}`,
    description: '可帮忙整理活动签到动线与现场指引说明。',
    priceMode: 'FIXED',
    amount: 9,
    locationNote: '线上沟通后交付'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_8 ?? 'user06@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_8 ?? 'user06',
    intent: 'REQUEST',
    category: 'AGENCY',
    title: `HTTP 集成材料代交 ${Date.now()}`,
    description: '明早需要帮忙把校园卡补办材料交到学生服务中心窗口，材料都已整理好。',
    priceMode: 'FIXED',
    amount: 10,
    locationNote: '学生服务中心'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_9 ?? 'user07@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_9 ?? 'user07',
    intent: 'OFFER',
    category: 'SKILL',
    title: `HTTP 集成设计排版 ${Date.now()}`,
    description: '今晚可帮忙做简历排版、基础海报设计和简单图片处理。',
    priceMode: 'FIXED',
    amount: 25,
    locationNote: '线上沟通'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_10 ?? 'user09@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_10 ?? 'user09',
    intent: 'REQUEST',
    category: 'GROUP_BUY',
    title: `HTTP 集成法学院拼单 ${Date.now()}`,
    description: '晚间一起拼打印和资料装订，下单后按人数平摊费用。',
    priceMode: 'FIXED',
    amount: 2,
    locationNote: '群里确认打印份数后统一下单'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_11 ?? 'user10@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_11 ?? 'user10',
    intent: 'REQUEST',
    category: 'ERRAND',
    title: `HTTP 集成园艺学院资料转交 ${Date.now()}`,
    description: '下午需要帮忙把社团资料从教学楼顺路转交到学院办公室。',
    priceMode: 'FIXED',
    amount: 7,
    locationNote: '教学楼 A 区到园艺园林学院办公室'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_12 ?? 'user11@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_12 ?? 'user11',
    intent: 'OFFER',
    category: 'SKILL',
    title: `HTTP 集成药学院表格整理 ${Date.now()}`,
    description: '今晚可帮忙整理实验记录表、课程汇总表和基础数据排版。',
    priceMode: 'FIXED',
    amount: 16,
    locationNote: '线上沟通后交付'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_13 ?? 'user12@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_13 ?? 'user12',
    intent: 'OFFER',
    category: 'HELP',
    title: `HTTP 集成动物科技学院顺路帮忙 ${Date.now()}`,
    description: '晚间可顺路帮忙送资料、带饭或把小件物品送到学院楼值班点。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '宿舍区到动物科技学院楼'
  }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(path, options = {}) {
  const { method = 'GET', headers = {}, body } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body
  });

  const raw = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  const payload = raw && contentType.includes('application/json') ? JSON.parse(raw) : raw;

  if (!response.ok) {
    const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
    throw new Error(`${method} ${path} failed: ${response.status} ${detail}`);
  }

  return payload;
}

async function loginAccount(account, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account,
      password
    })
  });

  const raw = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  const payload = raw && contentType.includes('application/json') ? JSON.parse(raw) : raw;

  if (!response.ok) {
    const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
    throw new Error(`POST /auth/login failed: ${response.status} ${detail}`);
  }

  assert(payload?.user?.id, `login user.id missing for ${account}`);
  const accessToken = response.headers.get('st-access-token');
  const refreshToken = response.headers.get('st-refresh-token');
  const frontToken = response.headers.get('front-token');
  const setCookie = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie().join('; ')
    : (response.headers.get('set-cookie') ?? '');
  const authHeaders = payload?.devAuthToken
    ? { 'x-dev-auth-user-id': String(payload.devAuthToken) }
    : accessToken
      ? {
          authorization: `Bearer ${accessToken}`,
          ...(refreshToken ? { 'st-refresh-token': refreshToken } : {}),
          ...(frontToken ? { 'front-token': frontToken } : {}),
          'st-auth-mode': 'header'
        }
    : setCookie
      ? { cookie: setCookie }
      : null;

  assert(authHeaders, `login auth headers missing for ${account}`);

  return {
    ...payload,
    authHeaders
  };
}

async function runCase(name, execute) {
  const startedAt = Date.now();
  try {
    const detail = await execute();
    return {
      name,
      status: 'passed',
      durationMs: Date.now() - startedAt,
      detail
    };
  } catch (error) {
    return {
      name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main() {
  const results = [];

  const health = await runCase('health', async () => {
    const payload = await requestJson('/health');
    assert(payload.status === 'ok', 'health status is not ok');
    return payload;
  });
  results.push(health);

  const login = await runCase('auth.login', async () => {
    const payload = await loginAccount(LOGIN_ACCOUNT, LOGIN_PASSWORD);
    return {
      userId: payload.user.id,
      account: payload.account,
      role: payload.user.role,
      verificationStatus: payload.user.verificationStatus,
      devAuthToken: payload.devAuthToken ?? null,
      authHeaders: payload.authHeaders
    };
  });
  results.push(login);

  const authHeaders = login.status === 'passed' ? { ...login.detail.authHeaders } : {};

  results.push(await runCase('products.home-recommendations', async () => {
    const payload = await requestJson('/products/home-recommendations', {
      headers: authHeaders
    });
    assert(Array.isArray(payload), 'home recommendations is not array');
    return {
      count: payload.length,
      sampleIds: payload.slice(0, 5).map((item) => item.id)
    };
  }));

  results.push(await runCase('products.publishing-rules', async () => {
    const payload = await requestJson('/products/publishing-rules');
    assert(payload && typeof payload === 'object', 'publishing rules payload missing');
    return {
      keys: Object.keys(payload).slice(0, 10)
    };
  }));

  results.push(await runCase('favorites.list', async () => {
    assert(Object.keys(authHeaders).length > 0, 'no auth headers for favorites');
    const payload = await requestJson('/favorites', {
      headers: authHeaders
    });
    assert(Array.isArray(payload.items), 'favorites.items is not array');
    return {
      total: payload.total,
      sampleIds: payload.items.slice(0, 5).map((item) => item.id)
    };
  }));

  results.push(await runCase('orders.list', async () => {
    assert(Object.keys(authHeaders).length > 0, 'no auth headers for orders');
    const payload = await requestJson('/orders?page=1&pageSize=5', {
      headers: authHeaders
    });
    assert(Array.isArray(payload.items), 'orders.items is not array');
    return {
      total: payload.pagination?.total ?? payload.items.length,
      sampleIds: payload.items.slice(0, 5).map((item) => item.id)
    };
  }));

  results.push(await runCase('users.history', async () => {
    assert(Object.keys(authHeaders).length > 0, 'no auth headers for history');
    const payload = await requestJson('/users/me/history?page=1&pageSize=5', {
      headers: authHeaders
    });
    assert(Array.isArray(payload.items), 'history.items is not array');
    return {
      total: payload.pagination?.total ?? payload.items.length,
      sampleTypes: payload.items.slice(0, 5).map((item) => item.type)
    };
  }));

  results.push(await runCase('users.following', async () => {
    assert(Object.keys(authHeaders).length > 0, 'no auth headers for following');
    const payload = await requestJson('/users/me/following?page=1&pageSize=5', {
      headers: authHeaders
    });
    assert(Array.isArray(payload.items), 'following.items is not array');
    return {
      total: payload.pagination?.total ?? payload.items.length,
      sampleIds: payload.items.slice(0, 5).map((item) => item.id)
    };
  }));

  results.push(await runCase('messages.conversations', async () => {
    assert(Object.keys(authHeaders).length > 0, 'no auth headers for messages');
    const payload = await requestJson('/messages/conversations', {
      headers: authHeaders
    });
    assert(Array.isArray(payload), 'conversations payload is not array');
    return {
      total: payload.length,
      sampleIds: payload.slice(0, 5).map((item) => item.id)
    };
  }));

  results.push(await runCase('campus-services.multi-user-publish-and-list', async () => {
    const published = [];

    for (const seed of CAMPUS_SERVICE_TEST_ACCOUNTS) {
      const auth = await loginAccount(seed.account, seed.password);
      const now = Date.now();
      const payload = await requestJson('/campus-services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...auth.authHeaders
        },
        body: JSON.stringify({
          intent: seed.intent,
          pattern: seed.intent === 'OFFER' ? 'REUSABLE' : 'ONE_TIME',
          title: seed.title,
          category: seed.category,
          description: seed.description,
          priceMode: seed.priceMode,
          amount: seed.amount,
          ...(seed.priceMode === 'FREE' ? {} : { reward: seed.amount }),
          locationMode: 'FLEXIBLE',
          locationNote: seed.locationNote,
          validFromAt: new Date(now + 5 * 60 * 1000).toISOString(),
          validUntilAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
          estimatedMinutes: seed.intent === 'OFFER' ? 30 : 20,
          urgency: seed.intent === 'OFFER' ? 'NORMAL' : 'TODAY',
          fulfillmentMode: 'FLEXIBLE',
          itemCount: 1,
          maxTotalOrders: seed.intent === 'OFFER' ? 2 : 1,
          maxConcurrentOrders: 1,
          imageUrls: ['https://cdn.example.com/http-integration-campus-service.jpg']
        })
      });

      assert(payload?.id, `campus service id missing for ${seed.account}`);
      assert(payload?.category === seed.category, `campus service category mismatch for ${seed.account}`);
      assert(payload?.intent === seed.intent, `campus service intent mismatch for ${seed.account}`);

      const listPayload = await requestJson(`/campus-services?ownerId=${auth.user.id}&page=1&pageSize=12`, {
        headers: auth.authHeaders
      });
      assert(Array.isArray(listPayload.items), `campus service list is not array for ${seed.account}`);
      assert(
        listPayload.items.some((item) => item.id === payload.id && item.serviceType?.key === seed.category),
        `new campus service not found in owner list for ${seed.account}`
      );

      published.push({
        publisherId: auth.user.id,
        listingId: payload.id,
        intent: payload.intent,
        category: payload.category
      });
    }

    const categories = new Set(published.map((item) => item.category));
    const intents = new Set(published.map((item) => item.intent));
    const publishers = new Set(published.map((item) => item.publisherId));

    assert(categories.has('ERRAND'), 'ERRAND campus service missing from multi-user publish');
    assert(categories.has('MOVING'), 'MOVING campus service missing from multi-user publish');
    assert(categories.has('GROUP_BUY'), 'GROUP_BUY campus service missing from multi-user publish');
    assert(categories.has('HELP'), 'HELP campus service missing from multi-user publish');
    assert(categories.has('TUTORING'), 'TUTORING campus service missing from multi-user publish');
    assert(categories.has('REPAIR'), 'REPAIR campus service missing from multi-user publish');
    assert(categories.has('EVENT'), 'EVENT campus service missing from multi-user publish');
    assert(categories.has('AGENCY'), 'AGENCY campus service missing from multi-user publish');
    assert(categories.has('SKILL'), 'SKILL campus service missing from multi-user publish');
    assert(intents.has('REQUEST'), 'REQUEST campus service missing from multi-user publish');
    assert(intents.has('OFFER'), 'OFFER campus service missing from multi-user publish');
    assert(publishers.size >= 14, 'expected at least 14 distinct campus service publishers');

    return {
      count: published.length,
      publisherCount: publishers.size,
      categories: [...categories],
      intents: [...intents],
      published
    };
  }));

  const passed = results.filter((item) => item.status === 'passed').length;
  const failed = results.length - passed;
  const summary = {
    apiBaseUrl: API_BASE_URL,
    executedAt: new Date().toISOString(),
    passed,
    failed,
    results
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
