#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'screenshots');
const BASE_URL = process.env.SWAPCAMPUS_BASE_URL ?? 'http://127.0.0.1:5178';
const API_BASE_URL = process.env.SWAPCAMPUS_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
const SESSION_KEY = 'swapcampus-session';
const DEV_AUTH_TOKEN_KEY = 'swapcampus-dev-auth-token';
const FAVORITES_KEY = 'swapcampus-favorites';

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/google/chrome/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // try next
    }
  }

  throw new Error('未找到可用的 Chrome/Chromium，可通过 CHROME_BIN 指定浏览器路径');
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
      execSync('npm init -y >/dev/null 2>&1', { cwd: cacheDir, stdio: 'inherit', shell: '/bin/zsh' });
    }

    try {
      await fs.access(path.join(cacheDir, 'node_modules', 'playwright-core'));
    } catch {
      execSync('npm install playwright-core >/dev/null 2>&1', {
        cwd: cacheDir,
        stdio: 'inherit',
        shell: '/bin/zsh'
      });
    }

    return createRequire(path.join(cacheDir, 'package.json'))('playwright-core');
  }
}

async function waitStable(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch {
    // Some pages keep background connections alive; fall back to a short settle delay.
  }
  await page.waitForTimeout(1200);
}

async function openPage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitStable(page);
}

async function prepareSession(page, session) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ sessionKey, sessionData }) => {
      localStorage.setItem(sessionKey, JSON.stringify(sessionData));
    },
    { sessionKey: SESSION_KEY, sessionData: session }
  );
}

async function loginByApi(account, password) {
  return apiJson('/auth/login', {
    method: 'POST',
    body: { account, password }
  });
}

async function prepareLoggedInSession(page, authSession) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ sessionKey, tokenKey, auth }) => {
      localStorage.setItem(
        sessionKey,
        JSON.stringify({
          user: auth.user
        })
      );
      if (auth.devAuthToken) {
        localStorage.setItem(tokenKey, auth.devAuthToken);
      }
    },
    {
      sessionKey: SESSION_KEY,
      tokenKey: DEV_AUTH_TOKEN_KEY,
      auth: authSession
    }
  );
}

async function prepareFavorites(page, session, productIds) {
  await page.evaluate(
    ({ favoritesKey, sessionData, ids }) => {
      const currentRaw = localStorage.getItem(favoritesKey);
      const currentMap = currentRaw ? JSON.parse(currentRaw) : {};
      currentMap[String(sessionData.id)] = ids;
      localStorage.setItem(favoritesKey, JSON.stringify(currentMap));
    },
    {
      favoritesKey: FAVORITES_KEY,
      sessionData: session,
      ids: productIds
    }
  );
}

async function apiJson(endpoint, options = {}, authSession) {
  const { method = 'GET', body, headers = {} } = options;
  const finalHeaders = { ...headers };

  if (authSession?.devAuthToken) {
    finalHeaders['x-dev-auth-user-id'] = authSession.devAuthToken;
  }

  let requestBody;
  if (body !== undefined) {
    if (!finalHeaders['Content-Type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }
    requestBody = finalHeaders['Content-Type'] === 'application/json'
      ? JSON.stringify(body)
      : body;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: finalHeaders,
    body: requestBody
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} 失败: ${response.status} ${raw}`);
  }

  return raw ? JSON.parse(raw) : null;
}

function extractProductItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.items)) {
    return payload.items;
  }

  return [];
}

async function ensureFavoriteRecords(authSession, productIds) {
  for (const productId of productIds) {
    try {
      await apiJson(`/favorites/${productId}`, {
        method: 'POST'
      }, authSession);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (!detail.includes('已') && !detail.includes('exists') && !detail.includes('unique')) {
        throw error;
      }
    }
  }
}

async function ensureTradeConversation(authSession, products) {
  const candidate = products.find((item) => item?.sellerId && item.sellerId !== authSession.user.id) ?? products[0];
  if (!candidate?.id) {
    return null;
  }

  const created = await apiJson('/messages/conversations', {
    method: 'POST',
    body: {
      productId: candidate.id,
      initialMessage: '你好，这件商品还在吗？我想这两天当面看看。'
    }
  }, authSession);

  const messages = await apiJson(`/messages/conversations/${created.id}`, {}, authSession);
  if (!Array.isArray(messages) || messages.length === 0) {
    await apiJson(`/messages/conversations/${created.id}`, {
      method: 'POST',
      body: {
        content: '你好，这件商品还在吗？我想这两天当面看看。'
      }
    }, authSession);
  }

  return created.id;
}

async function expandIfVisible(page, label) {
  const summary = page.getByText(label, { exact: true });
  if (await summary.count()) {
    await summary.first().click();
    await page.waitForTimeout(400);
  }
}

async function scrollToTop(page) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(300);
}

async function main() {
  const { chromium } = await ensurePlaywrightCore();
  const chromePath = resolveChromePath();

  await fs.mkdir(OUT_DIR, { recursive: true });

  const userAuthSession = await loginByApi('user', 'user');
  const adminAuthSession = await loginByApi('admin', 'admin');

  const productPayload = await apiJson('/products?page=1&pageSize=12');
  const productList = extractProductItems(productPayload);
  const detailId = productList.length ? productList[0].id : 1;
  const favoriteProductIds = productList.length
    ? productList.slice(0, 8).map((item) => item.id)
    : [1, 2, 3, 4];
  const backendFavoriteIds = favoriteProductIds.slice(0, 4);

  await ensureFavoriteRecords(userAuthSession, backendFavoriteIds);
  const tradeConversationId = await ensureTradeConversation(userAuthSession, productList);
  const serviceConversations = await apiJson('/messages/conversations', {}, userAuthSession);
  const serviceConversationId = Array.isArray(serviceConversations)
    ? (serviceConversations.find((item) => item?.campusServiceOrderId)?.id ?? null)
    : null;

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true
  });

  try {
    const guestContext = await browser.newContext({
      viewport: { width: 1440, height: 1080 }
    });
    const guestPage = await guestContext.newPage();
    await openPage(guestPage, `${BASE_URL}/login`);
    await guestPage.screenshot({ path: path.join(OUT_DIR, 'login-final.png') });
    await guestContext.close();

    const userContext = await browser.newContext({
      viewport: { width: 1440, height: 1080 }
    });
    const userPage = await userContext.newPage();
    await prepareLoggedInSession(userPage, userAuthSession);
    await prepareFavorites(userPage, userAuthSession.user, favoriteProductIds);

    await openPage(userPage, `${BASE_URL}/`);
    await userPage.screenshot({ path: path.join(OUT_DIR, 'home-final.png') });

    await openPage(userPage, `${BASE_URL}/favorites`);
    await userPage.screenshot({ path: path.join(OUT_DIR, 'favorites-final.png') });

    await openPage(userPage, `${BASE_URL}/campus-services`);
    await userPage.screenshot({ path: path.join(OUT_DIR, 'campus-services-final.png') });

    await openPage(userPage, `${BASE_URL}/products/${detailId}`);
    await userPage.screenshot({ path: path.join(OUT_DIR, 'detail-final.png') });

    await openPage(userPage, `${BASE_URL}/publish`);
    await userPage.screenshot({ path: path.join(OUT_DIR, 'publish-final.png') });

    const messageUrl = serviceConversationId
      ? `${BASE_URL}/messages?conversationId=${serviceConversationId}&channel=service`
      : tradeConversationId
        ? `${BASE_URL}/messages?conversationId=${tradeConversationId}&channel=trade`
      : `${BASE_URL}/messages`;
    await openPage(userPage, messageUrl);
    await userPage.screenshot({ path: path.join(OUT_DIR, 'messages-final.png') });

    await openPage(userPage, `${BASE_URL}/profile`);
    await userPage.screenshot({ path: path.join(OUT_DIR, 'profile-final.png') });
    await userContext.close();

    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 1080 }
    });
    const adminPage = await adminContext.newPage();
    await prepareLoggedInSession(adminPage, adminAuthSession);
    await openPage(adminPage, `${BASE_URL}/admin`);
    await expandIfVisible(adminPage, '商品列表');
    await expandIfVisible(adminPage, '举报列表');
    await expandIfVisible(adminPage, '最近操作');
    await expandIfVisible(adminPage, '用户治理');
    await scrollToTop(adminPage);
    await adminPage.screenshot({ path: path.join(OUT_DIR, 'admin-final.png') });
    await adminContext.close();

    const outputs = [
      'login-final.png',
      'home-final.png',
      'favorites-final.png',
      'campus-services-final.png',
      'detail-final.png',
      'publish-final.png',
      'messages-final.png',
      'profile-final.png',
      'admin-final.png'
    ];

    for (const name of outputs) {
      const stat = await fs.stat(path.join(OUT_DIR, name));
      console.log(`${name}\t${stat.size}\t${stat.mtime.toISOString()}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[generate-screenshots] failed');
  console.error(error);
  process.exitCode = 1;
});
