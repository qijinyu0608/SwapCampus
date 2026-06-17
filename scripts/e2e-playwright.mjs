#!/usr/bin/env node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { getCampusServiceLocalImage } from './campus-service-local-images.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'e2e');
const BASE_URL = process.env.SWAPCAMPUS_BASE_URL ?? 'http://127.0.0.1:5178';
const API_BASE_URL = process.env.SWAPCAMPUS_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
const LOGIN_ACCOUNT = process.env.SWAPCAMPUS_TEST_ACCOUNT ?? 'user';
const LOGIN_PASSWORD = process.env.SWAPCAMPUS_TEST_PASSWORD ?? 'user';
const PUBLIC_PROFILE_ACCOUNT = process.env.SWAPCAMPUS_PUBLIC_PROFILE_ACCOUNT ?? 'user01@swapcampus.local';
const PUBLIC_PROFILE_PASSWORD = process.env.SWAPCAMPUS_PUBLIC_PROFILE_PASSWORD ?? 'user01';
const SECOND_PUBLIC_PROFILE_ACCOUNT = process.env.SWAPCAMPUS_SECOND_PUBLIC_PROFILE_ACCOUNT ?? 'user10@swapcampus.local';
const SECOND_PUBLIC_PROFILE_PASSWORD = process.env.SWAPCAMPUS_SECOND_PUBLIC_PROFILE_PASSWORD ?? 'user10';
const THIRD_PUBLIC_PROFILE_ACCOUNT = process.env.SWAPCAMPUS_THIRD_PUBLIC_PROFILE_ACCOUNT ?? 'user13@swapcampus.local';
const THIRD_PUBLIC_PROFILE_PASSWORD = process.env.SWAPCAMPUS_THIRD_PUBLIC_PROFILE_PASSWORD ?? 'user13';
const FOURTH_PUBLIC_PROFILE_ACCOUNT = process.env.SWAPCAMPUS_FOURTH_PUBLIC_PROFILE_ACCOUNT ?? 'user19@swapcampus.local';
const FOURTH_PUBLIC_PROFILE_PASSWORD = process.env.SWAPCAMPUS_FOURTH_PUBLIC_PROFILE_PASSWORD ?? 'user19';
const FIFTH_PUBLIC_PROFILE_ACCOUNT = process.env.SWAPCAMPUS_FIFTH_PUBLIC_PROFILE_ACCOUNT ?? 'user26@swapcampus.local';
const FIFTH_PUBLIC_PROFILE_PASSWORD = process.env.SWAPCAMPUS_FIFTH_PUBLIC_PROFILE_PASSWORD ?? 'user26';
const SIXTH_PUBLIC_PROFILE_ACCOUNT = process.env.SWAPCAMPUS_SIXTH_PUBLIC_PROFILE_ACCOUNT ?? 'user31@swapcampus.local';
const SIXTH_PUBLIC_PROFILE_PASSWORD = process.env.SWAPCAMPUS_SIXTH_PUBLIC_PROFILE_PASSWORD ?? 'user31';
const SEVENTH_PUBLIC_PROFILE_ACCOUNT = process.env.SWAPCAMPUS_SEVENTH_PUBLIC_PROFILE_ACCOUNT ?? 'user43@swapcampus.local';
const SEVENTH_PUBLIC_PROFILE_PASSWORD = process.env.SWAPCAMPUS_SEVENTH_PUBLIC_PROFILE_PASSWORD ?? 'user43';
const SESSION_KEY = 'swapcampus-session';
const DEV_AUTH_TOKEN_KEY = 'swapcampus-dev-auth-token';
const FAVORITES_KEY = 'swapcampus-favorites';
const E2E_TS = Date.now();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/google/chrome/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // continue
    }
  }

  throw new Error('no available Chrome/Chromium found');
}

async function ensurePlaywrightCore() {
  try {
    return createRequire(import.meta.url)('playwright-core');
  } catch {
    const cacheDir = path.join(os.tmpdir(), 'swapcampus-playwright-core');
    const pkgJson = path.join(cacheDir, 'package.json');

    await fs.mkdir(cacheDir, { recursive: true });
    try {
      await fs.access(pkgJson);
    } catch {
      execSync('npm init -y >/dev/null 2>&1', { cwd: cacheDir, stdio: 'inherit', shell: '/bin/bash' });
    }

    try {
      await fs.access(path.join(cacheDir, 'node_modules', 'playwright-core'));
    } catch {
      execSync('npm install playwright-core >/dev/null 2>&1', { cwd: cacheDir, stdio: 'inherit', shell: '/bin/bash' });
    }

    return createRequire(path.join(cacheDir, 'package.json'))('playwright-core');
  }
}

async function waitStable(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch {
    // ignore noisy background requests
  }
  await page.waitForTimeout(800);
}

async function apiJson(endpoint, options = {}, devAuthToken) {
  const { method = 'GET', body, headers = {} } = options;
  const finalHeaders = { ...headers };
  if (devAuthToken) {
    finalHeaders['x-dev-auth-user-id'] = devAuthToken;
  }
  if (body !== undefined && !finalHeaders['Content-Type']) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: finalHeaders,
    body: body === undefined
      ? undefined
      : finalHeaders['Content-Type'] === 'application/json'
        ? JSON.stringify(body)
        : body
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} failed: ${response.status} ${raw}`);
  }

  return raw ? JSON.parse(raw) : null;
}

async function loginByApi() {
  return loginAccount(LOGIN_ACCOUNT, LOGIN_PASSWORD);
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
    throw new Error(`POST /auth/login failed: ${response.status} ${raw}`);
  }

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

  assert(payload?.user?.id, `login session missing user for ${account}`);
  assert(authHeaders, `login auth headers missing for ${account}`);

  return {
    ...payload,
    authHeaders
  };
}

async function prepareLoggedInSession(page, authSession) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ sessionKey, tokenKey, auth }) => {
      localStorage.setItem(sessionKey, JSON.stringify({ user: auth.user }));
      localStorage.setItem(tokenKey, String(auth.devAuthToken));
    },
    {
      sessionKey: SESSION_KEY,
      tokenKey: DEV_AUTH_TOKEN_KEY,
      auth: authSession
    }
  );
}

async function prepareFavorites(page, userId, productIds) {
  await page.evaluate(
    ({ favoritesKey, userIdValue, ids }) => {
      const currentRaw = localStorage.getItem(favoritesKey);
      const currentMap = currentRaw ? JSON.parse(currentRaw) : {};
      currentMap[String(userIdValue)] = ids;
      localStorage.setItem(favoritesKey, JSON.stringify(currentMap));
    },
    {
      favoritesKey: FAVORITES_KEY,
      userIdValue: userId,
      ids: productIds
    }
  );
}

async function ensureFavoriteRecords(devAuthToken, productIds) {
  for (const productId of productIds) {
    try {
      await apiJson(`/favorites/${productId}`, {
        method: 'POST'
      }, devAuthToken);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (!detail.includes('已') && !detail.includes('exists') && !detail.includes('unique')) {
        throw error;
      }
    }
  }
}

async function ensureFavoriteRecordsByHeaders(authHeaders, productIds) {
  for (const productId of productIds) {
    try {
      await apiJson(`/favorites/${productId}`, {
        method: 'POST',
        headers: authHeaders
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (!detail.includes('已') && !detail.includes('exists') && !detail.includes('unique')) {
        throw error;
      }
    }
  }
}

async function createCampusServiceListing(seed, auth) {
  const now = Date.now();
  return apiJson('/campus-services', {
    method: 'POST',
    headers: typeof auth === 'string' ? undefined : auth,
    body: {
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
      imageUrls: [getCampusServiceLocalImage(seed.category)]
    }
  }, typeof auth === 'string' ? auth : undefined);
}

async function takeScreenshot(page, name) {
  const target = path.join(OUT_DIR, name);
  await page.screenshot({ path: target, fullPage: true });
  return target;
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
  await fs.mkdir(OUT_DIR, { recursive: true });

  const authSession = await loginByApi();
  assert(authSession?.user?.id, 'login session missing user');
  const productsPayload = await apiJson('/products?page=1&pageSize=12', {
    headers: authSession.authHeaders
  });
  const products = Array.isArray(productsPayload?.items) ? productsPayload.items : [];
  assert(products.length > 0, 'no products available for e2e');

  const favoriteIds = products.slice(0, 4).map((item) => item.id);
  if (authSession.devAuthToken) {
    await ensureFavoriteRecords(String(authSession.devAuthToken), favoriteIds);
  } else {
    await ensureFavoriteRecordsByHeaders(authSession.authHeaders, favoriteIds);
  }
  const publicProfileSession = await loginAccount(PUBLIC_PROFILE_ACCOUNT, PUBLIC_PROFILE_PASSWORD);
  assert(publicProfileSession?.user?.id, 'public profile session missing user');
  const secondPublicProfileSession = await loginAccount(SECOND_PUBLIC_PROFILE_ACCOUNT, SECOND_PUBLIC_PROFILE_PASSWORD);
  assert(secondPublicProfileSession?.user?.id, 'second public profile session missing user');
  const thirdPublicProfileSession = await loginAccount(THIRD_PUBLIC_PROFILE_ACCOUNT, THIRD_PUBLIC_PROFILE_PASSWORD);
  assert(thirdPublicProfileSession?.user?.id, 'third public profile session missing user');
  const fourthPublicProfileSession = await loginAccount(FOURTH_PUBLIC_PROFILE_ACCOUNT, FOURTH_PUBLIC_PROFILE_PASSWORD);
  assert(fourthPublicProfileSession?.user?.id, 'fourth public profile session missing user');
  const fifthPublicProfileSession = await loginAccount(FIFTH_PUBLIC_PROFILE_ACCOUNT, FIFTH_PUBLIC_PROFILE_PASSWORD);
  assert(fifthPublicProfileSession?.user?.id, 'fifth public profile session missing user');
  const sixthPublicProfileSession = await loginAccount(SIXTH_PUBLIC_PROFILE_ACCOUNT, SIXTH_PUBLIC_PROFILE_PASSWORD);
  assert(sixthPublicProfileSession?.user?.id, 'sixth public profile session missing user');
  const seventhPublicProfileSession = await loginAccount(SEVENTH_PUBLIC_PROFILE_ACCOUNT, SEVENTH_PUBLIC_PROFILE_PASSWORD);
  assert(seventhPublicProfileSession?.user?.id, 'seventh public profile session missing user');
  const createdRequest = await createCampusServiceListing({
    intent: 'REQUEST',
    category: 'ERRAND',
    title: `今晚南门快递代取 ${E2E_TS}`,
    description: '今晚六点后在南门快递点有两个包裹，想请同学顺路带回 6 号宿舍楼下。',
    priceMode: 'FIXED',
    amount: 8,
    locationNote: '南门快递点到 6 号宿舍楼'
  }, authSession.devAuthToken ? String(authSession.devAuthToken) : authSession.authHeaders);
  const createdOffer = await createCampusServiceListing({
    intent: 'OFFER',
    category: 'HELP',
    title: `晚间宿舍区顺路带饭 ${E2E_TS}`,
    description: '今晚会从学五餐厅回宿舍区，可以顺路帮带一份晚饭或饮料。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '学五餐厅到宿舍区'
  }, authSession.devAuthToken ? String(authSession.devAuthToken) : authSession.authHeaders);
  assert(createdRequest?.id, 'failed to create request listing for e2e');
  assert(createdOffer?.id, 'failed to create offer listing for e2e');
  const createdPublicRequest = await createCampusServiceListing({
    intent: 'REQUEST',
    category: 'MOVING',
    title: `周末宿舍搬箱子 ${E2E_TS}`,
    description: '周六下午需要把两箱书从 3 号楼搬到 7 号楼电梯口，希望有人帮忙一起抬。',
    priceMode: 'FIXED',
    amount: 15,
    locationNote: '3 号楼到 7 号楼'
  }, publicProfileSession.devAuthToken ? String(publicProfileSession.devAuthToken) : publicProfileSession.authHeaders);
  const createdPublicGroupBuy = await createCampusServiceListing({
    intent: 'REQUEST',
    category: 'GROUP_BUY',
    title: `校内午餐拼单 ${E2E_TS}`,
    description: '中午一起拼轻食外卖，凑满减后按人数平摊，群里统一确认后下单。',
    priceMode: 'FIXED',
    amount: 1,
    locationNote: '群里统一确认后下单'
  }, publicProfileSession.devAuthToken ? String(publicProfileSession.devAuthToken) : publicProfileSession.authHeaders);
  const createdPublicOffer = await createCampusServiceListing({
    intent: 'OFFER',
    category: 'TUTORING',
    title: `高数期末答疑 ${E2E_TS}`,
    description: '这周可以线上答疑高数期末复习，主要讲极限、导数和积分基础题型。',
    priceMode: 'FIXED',
    amount: 30,
    locationNote: '腾讯会议线上答疑'
  }, publicProfileSession.devAuthToken ? String(publicProfileSession.devAuthToken) : publicProfileSession.authHeaders);
  assert(createdPublicRequest?.id, 'failed to create public profile request listing for e2e');
  assert(createdPublicGroupBuy?.id, 'failed to create public profile group buy listing for e2e');
  assert(createdPublicOffer?.id, 'failed to create public profile offer listing for e2e');
  const createdSecondPublicHelp = await createCampusServiceListing({
    intent: 'OFFER',
    category: 'HELP',
    title: `园艺学院晚间顺路帮忙 ${E2E_TS}`,
    description: '今晚会从图书馆回园艺园林学院楼，可以顺路帮送资料或代拿小件物品。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '图书馆到园艺园林学院楼'
  }, secondPublicProfileSession.devAuthToken ? String(secondPublicProfileSession.devAuthToken) : secondPublicProfileSession.authHeaders);
  const createdSecondPublicSkill = await createCampusServiceListing({
    intent: 'OFFER',
    category: 'SKILL',
    title: `园艺学院表格排版 ${E2E_TS}`,
    description: '今晚可帮忙整理活动报名表、实验记录表和基础数据排版。',
    priceMode: 'FIXED',
    amount: 18,
    locationNote: '线上沟通后交付'
  }, secondPublicProfileSession.devAuthToken ? String(secondPublicProfileSession.devAuthToken) : secondPublicProfileSession.authHeaders);
  assert(createdSecondPublicHelp?.id, 'failed to create second public help listing for e2e');
  assert(createdSecondPublicSkill?.id, 'failed to create second public skill listing for e2e');
  const createdThirdPublicEvent = await createCampusServiceListing({
    intent: 'REQUEST',
    category: 'EVENT',
    title: `资源学院活动签到值守 ${E2E_TS}`,
    description: '明天下午活动开始前需要同学先到教室门口帮忙看签到台和引导入场 20 分钟。',
    priceMode: 'FIXED',
    amount: 12,
    locationNote: '资源与环境学院报告厅门口'
  }, thirdPublicProfileSession.devAuthToken ? String(thirdPublicProfileSession.devAuthToken) : thirdPublicProfileSession.authHeaders);
  const createdThirdPublicTutoring = await createCampusServiceListing({
    intent: 'OFFER',
    category: 'TUTORING',
    title: `资源学院数据处理答疑 ${E2E_TS}`,
    description: '这周可线上答疑 Excel 数据清洗、基础图表和公开展示排版。',
    priceMode: 'FIXED',
    amount: 24,
    locationNote: '线上语音或站内消息约时间'
  }, thirdPublicProfileSession.devAuthToken ? String(thirdPublicProfileSession.devAuthToken) : thirdPublicProfileSession.authHeaders);
  assert(createdThirdPublicEvent?.id, 'failed to create third public event listing for e2e');
  assert(createdThirdPublicTutoring?.id, 'failed to create third public tutoring listing for e2e');
  const createdFourthPublicAgency = await createCampusServiceListing({
    intent: 'REQUEST',
    category: 'AGENCY',
    title: `材料学院资料代交 ${E2E_TS}`,
    description: '整理好的纸质材料需要帮忙送到学院办公室。',
    priceMode: 'FIXED',
    amount: 8,
    locationNote: '材料科学与工程学院办公室'
  }, fourthPublicProfileSession.devAuthToken ? String(fourthPublicProfileSession.devAuthToken) : fourthPublicProfileSession.authHeaders);
  const createdFourthPublicHelp = await createCampusServiceListing({
    intent: 'OFFER',
    category: 'HELP',
    title: `材料学院晚间顺路帮忙 ${E2E_TS}`,
    description: '晚间回宿舍途中可顺路帮忙带饭、送资料。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '材料学院宿舍区内顺路帮忙'
  }, fourthPublicProfileSession.devAuthToken ? String(fourthPublicProfileSession.devAuthToken) : fourthPublicProfileSession.authHeaders);
  assert(createdFourthPublicAgency?.id, 'failed to create fourth public agency listing for e2e');
  assert(createdFourthPublicHelp?.id, 'failed to create fourth public help listing for e2e');
  const createdFifthPublicErrand = await createCampusServiceListing({
    intent: 'REQUEST',
    category: 'ERRAND',
    title: `计控学院资料代拿 ${E2E_TS}`,
    description: '图书馆服务台的资料需要顺路代拿到教学楼。',
    priceMode: 'FIXED',
    amount: 5,
    locationNote: '图书馆服务台到教学楼'
  }, fifthPublicProfileSession.devAuthToken ? String(fifthPublicProfileSession.devAuthToken) : fifthPublicProfileSession.authHeaders);
  const createdFifthPublicSkill = await createCampusServiceListing({
    intent: 'OFFER',
    category: 'SKILL',
    title: `计控学院 PPT 梳理 ${E2E_TS}`,
    description: '今晚可帮忙梳理课程汇报 PPT 结构和视觉层级。',
    priceMode: 'FIXED',
    amount: 26,
    locationNote: '线上沟通'
  }, fifthPublicProfileSession.devAuthToken ? String(fifthPublicProfileSession.devAuthToken) : fifthPublicProfileSession.authHeaders);
  assert(createdFifthPublicErrand?.id, 'failed to create fifth public errand listing for e2e');
  assert(createdFifthPublicSkill?.id, 'failed to create fifth public skill listing for e2e');
  const createdSixthPublicMoving = await createCampusServiceListing({
    intent: 'REQUEST',
    category: 'MOVING',
    title: `化工学院跨楼搬箱 ${E2E_TS}`,
    description: '理科楼和实验楼之间需要搬两箱课程资料，适合顺路同学帮忙。',
    priceMode: 'FIXED',
    amount: 14,
    locationNote: '理科楼到实验楼'
  }, sixthPublicProfileSession.devAuthToken ? String(sixthPublicProfileSession.devAuthToken) : sixthPublicProfileSession.authHeaders);
  const createdSixthPublicTutoring = await createCampusServiceListing({
    intent: 'OFFER',
    category: 'TUTORING',
    title: `化工学院公开演讲陪练 ${E2E_TS}`,
    description: '今晚可线上梳理公开表达节奏、开场过渡和讲解逻辑。',
    priceMode: 'FIXED',
    amount: 28,
    locationNote: '线上语音或站内消息约时间'
  }, sixthPublicProfileSession.devAuthToken ? String(sixthPublicProfileSession.devAuthToken) : sixthPublicProfileSession.authHeaders);
  assert(createdSixthPublicMoving?.id, 'failed to create sixth public moving listing for e2e');
  assert(createdSixthPublicTutoring?.id, 'failed to create sixth public tutoring listing for e2e');
  const createdSeventhPublicErrand = await createCampusServiceListing({
    intent: 'REQUEST',
    category: 'ERRAND',
    title: `环工学院实验耗材代拿 ${E2E_TS}`,
    description: '实验课前需要把已预约的小件耗材从材料点带到实验楼大厅。',
    priceMode: 'FIXED',
    amount: 6,
    locationNote: '实验耗材领取点到实验楼大厅'
  }, seventhPublicProfileSession.devAuthToken ? String(seventhPublicProfileSession.devAuthToken) : seventhPublicProfileSession.authHeaders);
  const createdSeventhPublicSkill = await createCampusServiceListing({
    intent: 'OFFER',
    category: 'SKILL',
    title: `环工学院作品集封面微调 ${E2E_TS}`,
    description: '今晚可帮忙做作品集封面、目录页和统一字体层级微调。',
    priceMode: 'FIXED',
    amount: 22,
    locationNote: '线上沟通后交付'
  }, seventhPublicProfileSession.devAuthToken ? String(seventhPublicProfileSession.devAuthToken) : seventhPublicProfileSession.authHeaders);
  assert(createdSeventhPublicErrand?.id, 'failed to create seventh public errand listing for e2e');
  assert(createdSeventhPublicSkill?.id, 'failed to create seventh public skill listing for e2e');

  const { chromium } = await ensurePlaywrightCore();
  const browser = await chromium.launch({
    executablePath: resolveChromePath(),
    headless: true
  });

  try {
    const loginContext = await browser.newContext({
      viewport: { width: 1440, height: 960 }
    });
    const loginPage = await loginContext.newPage();
    const loginResult = await runCase('login-page-ui', async () => {
      await loginPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await waitStable(loginPage);
      await loginPage.getByPlaceholder('学号或邮箱').fill(LOGIN_ACCOUNT);
      await loginPage.getByPlaceholder('请输入密码').fill(LOGIN_PASSWORD);
      await loginPage.locator('.form-shell button[type="submit"]').click();
      await waitStable(loginPage);
      const currentUrl = loginPage.url();
      assert(!currentUrl.includes('/login'), `login did not leave login page: ${currentUrl}`);
      const screenshot = await takeScreenshot(loginPage, 'e2e-login-ui.png');
      return {
        url: currentUrl,
        screenshot
      };
    });
    await loginContext.close();

    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 }
    });
    const page = await context.newPage();
    assert(authSession.devAuthToken, 'primary e2e login session missing devAuthToken');
    await prepareLoggedInSession(page, authSession);
    await prepareFavorites(page, authSession.user.id, favoriteIds);

    const results = [loginResult];

    results.push(await runCase('home.search-navigation', async () => {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);
      await page.getByPlaceholder('搜索手机、电脑、教材、卡券').fill('教材');
      await page.getByRole('button', { name: '搜索' }).click();
      await waitStable(page);
      await expectUrlIncludes(page, '/search?q=');
      await page.getByText(/搜索 “教材”|搜索商品/).first().waitFor({ state: 'visible', timeout: 5000 });
      const screenshot = await takeScreenshot(page, 'e2e-home-search.png');
      return {
        url: page.url(),
        screenshot
      };
    }));

    results.push(await runCase('detail.favorite-and-message', async () => {
      await page.goto(`${BASE_URL}/products/${products[0].id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);
      await page.getByRole('button', { name: '收藏商品' }).click().catch(async () => {
        await page.getByRole('button', { name: '取消收藏' }).click();
      });
      await page.getByRole('button', { name: '聊一聊' }).click();
      await waitStable(page);
      await expectUrlIncludes(page, '/messages');
      const screenshot = await takeScreenshot(page, 'e2e-detail-message.png');
      return {
        url: page.url(),
        screenshot
      };
    }));

    results.push(await runCase('favorites-page', async () => {
      await page.goto(`${BASE_URL}/favorites`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);
      await page.getByText('收藏').first().waitFor({ state: 'visible', timeout: 5000 });
      const screenshot = await takeScreenshot(page, 'e2e-favorites.png');
      return {
        url: page.url(),
        screenshot
      };
    }));

    results.push(await runCase('profile-page', async () => {
      await page.goto(`${BASE_URL}/profile`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);
      await page.getByText(/我的|收藏|订单/).first().waitFor({ state: 'visible', timeout: 5000 });
      const screenshot = await takeScreenshot(page, 'e2e-profile.png');
      return {
        url: page.url(),
        screenshot
      };
    }));

    results.push(await runCase('profile.campus-service-publish-visibility', async () => {
      await page.goto(`${BASE_URL}/profile`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);

      await page.getByRole('button', { name: '我发布的需求' }).click();
      await waitStable(page);
      await page.getByText(createdRequest.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdRequest.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdRequest.id}`);
      await page.getByRole('button', { name: '返回列表' }).click().catch(() => {});

      await page.goto(`${BASE_URL}/profile`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);
      await page.getByRole('button', { name: '我发布的服务' }).click();
      await waitStable(page);
      await page.getByText(createdOffer.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdOffer.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdOffer.id}`);
      const screenshot = await takeScreenshot(page, 'e2e-profile-campus-service-publish-visibility.png');

      return {
        requestListingId: createdRequest.id,
        offerListingId: createdOffer.id,
        requestTitle: createdRequest.title,
        offerTitle: createdOffer.title,
        url: page.url(),
        screenshot
      };
    }));

    results.push(await runCase('public-user.campus-service-publish-visibility', async () => {
      await page.goto(`${BASE_URL}/users/${publicProfileSession.user.id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);

      await page.getByRole('tab', { name: /发布的需求/ }).click();
      await waitStable(page);
      await page.getByText(createdPublicRequest.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdPublicGroupBuy.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdPublicRequest.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdPublicRequest.id}`);

      await page.goto(`${BASE_URL}/users/${publicProfileSession.user.id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);
      await page.getByRole('tab', { name: /发布的服务/ }).click();
      await waitStable(page);
      await page.getByText(createdPublicOffer.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdPublicOffer.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdPublicOffer.id}`);
      const screenshot = await takeScreenshot(page, 'e2e-public-user-campus-service-publish-visibility.png');

      return {
        publicUserId: publicProfileSession.user.id,
        requestListingId: createdPublicRequest.id,
        groupBuyListingId: createdPublicGroupBuy.id,
        offerListingId: createdPublicOffer.id,
        requestTitle: createdPublicRequest.title,
        groupBuyTitle: createdPublicGroupBuy.title,
        offerTitle: createdPublicOffer.title,
        url: page.url(),
        screenshot
      };
    }));

    results.push(await runCase('public-user.second-publisher-visibility', async () => {
      await page.goto(`${BASE_URL}/users/${secondPublicProfileSession.user.id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);

      await page.getByRole('tab', { name: /发布的服务/ }).click();
      await waitStable(page);
      await page.getByText(createdSecondPublicHelp.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdSecondPublicSkill.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdSecondPublicSkill.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdSecondPublicSkill.id}`);
      const screenshot = await takeScreenshot(page, 'e2e-public-user-second-publisher.png');

      return {
        publicUserId: secondPublicProfileSession.user.id,
        helpListingId: createdSecondPublicHelp.id,
        skillListingId: createdSecondPublicSkill.id,
        helpTitle: createdSecondPublicHelp.title,
        skillTitle: createdSecondPublicSkill.title,
        url: page.url(),
        screenshot
      };
    }));

    results.push(await runCase('public-user.third-publisher-visibility', async () => {
      await page.goto(`${BASE_URL}/users/${thirdPublicProfileSession.user.id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);

      await page.getByRole('tab', { name: /发布的需求/ }).click();
      await waitStable(page);
      await page.getByText(createdThirdPublicEvent.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdThirdPublicEvent.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdThirdPublicEvent.id}`);

      await page.goto(`${BASE_URL}/users/${thirdPublicProfileSession.user.id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);
      await page.getByRole('tab', { name: /发布的服务/ }).click();
      await waitStable(page);
      await page.getByText(createdThirdPublicTutoring.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdThirdPublicTutoring.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdThirdPublicTutoring.id}`);
      const screenshot = await takeScreenshot(page, 'e2e-public-user-third-publisher.png');

      return {
        publicUserId: thirdPublicProfileSession.user.id,
        eventListingId: createdThirdPublicEvent.id,
        tutoringListingId: createdThirdPublicTutoring.id,
        eventTitle: createdThirdPublicEvent.title,
        tutoringTitle: createdThirdPublicTutoring.title,
        url: page.url(),
        screenshot
      };
    }));

    results.push(await runCase('public-user.fourth-publisher-visibility', async () => {
      await page.goto(`${BASE_URL}/users/${fourthPublicProfileSession.user.id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);

      await page.getByRole('tab', { name: /发布的需求/ }).click();
      await waitStable(page);
      await page.getByText(createdFourthPublicAgency.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdFourthPublicAgency.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdFourthPublicAgency.id}`);

      await page.goto(`${BASE_URL}/users/${fourthPublicProfileSession.user.id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);
      await page.getByRole('tab', { name: /发布的服务/ }).click();
      await waitStable(page);
      await page.getByText(createdFourthPublicHelp.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdFourthPublicHelp.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdFourthPublicHelp.id}`);
      const screenshot = await takeScreenshot(page, 'e2e-public-user-fourth-publisher.png');

      return {
        publicUserId: fourthPublicProfileSession.user.id,
        agencyListingId: createdFourthPublicAgency.id,
        helpListingId: createdFourthPublicHelp.id,
        agencyTitle: createdFourthPublicAgency.title,
        helpTitle: createdFourthPublicHelp.title,
        url: page.url(),
        screenshot
      };
    }));

    results.push(await runCase('public-user.fifth-publisher-visibility', async () => {
      await page.goto(`${BASE_URL}/users/${fifthPublicProfileSession.user.id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);

      await page.getByRole('tab', { name: /发布的需求/ }).click();
      await waitStable(page);
      await page.getByText(createdFifthPublicErrand.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdFifthPublicErrand.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdFifthPublicErrand.id}`);

      await page.goto(`${BASE_URL}/users/${fifthPublicProfileSession.user.id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);
      await page.getByRole('tab', { name: /发布的服务/ }).click();
      await waitStable(page);
      await page.getByText(createdFifthPublicSkill.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdFifthPublicSkill.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdFifthPublicSkill.id}`);
      const screenshot = await takeScreenshot(page, 'e2e-public-user-fifth-publisher.png');

      return {
        publicUserId: fifthPublicProfileSession.user.id,
        errandListingId: createdFifthPublicErrand.id,
        skillListingId: createdFifthPublicSkill.id,
        errandTitle: createdFifthPublicErrand.title,
        skillTitle: createdFifthPublicSkill.title,
        url: page.url(),
        screenshot
      };
    }));

    results.push(await runCase('public-user.sixth-publisher-visibility', async () => {
      await page.goto(`${BASE_URL}/users/${sixthPublicProfileSession.user.id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);

      await page.getByRole('tab', { name: /发布的需求/ }).click();
      await waitStable(page);
      await page.getByText(createdSixthPublicMoving.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdSixthPublicMoving.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdSixthPublicMoving.id}`);

      await page.goto(`${BASE_URL}/users/${sixthPublicProfileSession.user.id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);
      await page.getByRole('tab', { name: /发布的服务/ }).click();
      await waitStable(page);
      await page.getByText(createdSixthPublicTutoring.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdSixthPublicTutoring.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdSixthPublicTutoring.id}`);
      const screenshot = await takeScreenshot(page, 'e2e-public-user-sixth-publisher.png');

      return {
        publicUserId: sixthPublicProfileSession.user.id,
        movingListingId: createdSixthPublicMoving.id,
        tutoringListingId: createdSixthPublicTutoring.id,
        movingTitle: createdSixthPublicMoving.title,
        tutoringTitle: createdSixthPublicTutoring.title,
        url: page.url(),
        screenshot
      };
    }));

    results.push(await runCase('public-user.seventh-publisher-visibility', async () => {
      await page.goto(`${BASE_URL}/users/${seventhPublicProfileSession.user.id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);

      await page.getByRole('tab', { name: /发布的需求/ }).click();
      await waitStable(page);
      await page.getByText(createdSeventhPublicErrand.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdSeventhPublicErrand.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdSeventhPublicErrand.id}`);

      await page.goto(`${BASE_URL}/users/${seventhPublicProfileSession.user.id}`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);
      await page.getByRole('tab', { name: /发布的服务/ }).click();
      await waitStable(page);
      await page.getByText(createdSeventhPublicSkill.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdSeventhPublicSkill.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdSeventhPublicSkill.id}`);
      const screenshot = await takeScreenshot(page, 'e2e-public-user-seventh-publisher.png');

      return {
        publicUserId: seventhPublicProfileSession.user.id,
        errandListingId: createdSeventhPublicErrand.id,
        skillListingId: createdSeventhPublicSkill.id,
        errandTitle: createdSeventhPublicErrand.title,
        skillTitle: createdSeventhPublicSkill.title,
        url: page.url(),
        screenshot
      };
    }));

    results.push(await runCase('campus-services-page', async () => {
      await page.goto(`${BASE_URL}/campus-services`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);
      await page.getByPlaceholder('搜索路线、地点、任务').fill('快递');
      await page.getByRole('button', { name: '搜索' }).click();
      await waitStable(page);
      const screenshot = await takeScreenshot(page, 'e2e-campus-services.png');
      return {
        url: page.url(),
        screenshot
      };
    }));

    results.push(await runCase('campus-services.group-buy-discovery', async () => {
      await page.goto(`${BASE_URL}/campus-services`, { waitUntil: 'domcontentloaded' });
      await waitStable(page);
      await page.getByPlaceholder('搜索路线、地点、任务').fill('拼单');
      await page.getByRole('button', { name: '搜索' }).click();
      await waitStable(page);
      await page.getByText(createdPublicGroupBuy.title).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText(createdPublicGroupBuy.title).first().click();
      await waitStable(page);
      await expectUrlIncludes(page, `/campus-services/${createdPublicGroupBuy.id}`);
      const screenshot = await takeScreenshot(page, 'e2e-campus-services-group-buy.png');
      return {
        listingId: createdPublicGroupBuy.id,
        title: createdPublicGroupBuy.title,
        url: page.url(),
        screenshot
      };
    }));

    await context.close();

    const passed = results.filter((item) => item.status === 'passed').length;
    const failed = results.length - passed;
    const summary = {
      baseUrl: BASE_URL,
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
  } finally {
    await browser.close();
  }
}

async function expectUrlIncludes(page, fragment) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (page.url().includes(fragment)) {
      return;
    }
    await page.waitForTimeout(200);
  }

  throw new Error(`url did not include "${fragment}": ${page.url()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
