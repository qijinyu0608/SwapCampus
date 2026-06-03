#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = '/Users/qijinyu/Documents/software-design/SwapCampus';
const OUT_DIR = path.join(ROOT, 'artifacts', 'screenshots');
const BASE_URL = process.env.SWAPCAMPUS_BASE_URL ?? 'http://127.0.0.1:5178';
const API_BASE_URL = process.env.SWAPCAMPUS_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
const SESSION_KEY = 'swapcampus-demo-user';
const FAVORITES_KEY = 'swapcampus-favorites';

const userSession = {
  id: 24,
  studentId: '2026001001',
  name: '林舟',
  email: 'user1@stu.swapcampus.cn',
  role: 'USER',
  creditScore: 68,
  verified: true
};

const adminSession = {
  id: 22,
  studentId: '2026000001',
  name: '平台管理员',
  email: 'admin@swapcampus.cn',
  role: 'ADMIN',
  creditScore: 100,
  verified: true
};

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_BIN,
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
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
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

  const productList = await fetch(`${API_BASE_URL}/products`).then((response) => response.json());
  const detailId = Array.isArray(productList) && productList.length ? productList[0].id : 1;
  const favoriteProductIds = Array.isArray(productList)
    ? productList.slice(0, 8).map((item) => item.id)
    : [1, 2, 3, 4];

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true
  });

  try {
    const guestContext = await browser.newContext({
      viewport: { width: 1440, height: 1080 }
    });
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await waitStable(guestPage);
    await guestPage.screenshot({ path: path.join(OUT_DIR, 'login-final.png') });
    await guestContext.close();

    const userContext = await browser.newContext({
      viewport: { width: 1440, height: 1080 }
    });
    const userPage = await userContext.newPage();
    await prepareSession(userPage, userSession);
    await prepareFavorites(userPage, userSession, favoriteProductIds);

    await userPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await waitStable(userPage);
    await userPage.screenshot({ path: path.join(OUT_DIR, 'home-final.png') });

    await userPage.goto(`${BASE_URL}/favorites`, { waitUntil: 'networkidle' });
    await waitStable(userPage);
    await userPage.screenshot({ path: path.join(OUT_DIR, 'favorites-final.png') });

    await userPage.goto(`${BASE_URL}/products/${detailId}`, { waitUntil: 'networkidle' });
    await waitStable(userPage);
    await userPage.screenshot({ path: path.join(OUT_DIR, 'detail-final.png') });

    await userPage.goto(`${BASE_URL}/publish`, { waitUntil: 'networkidle' });
    await waitStable(userPage);
    await userPage.screenshot({ path: path.join(OUT_DIR, 'publish-final.png') });

    await userPage.goto(`${BASE_URL}/messages`, { waitUntil: 'networkidle' });
    await waitStable(userPage);
    await userPage.screenshot({ path: path.join(OUT_DIR, 'messages-final.png') });

    await userPage.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
    await waitStable(userPage);
    await userPage.screenshot({ path: path.join(OUT_DIR, 'profile-final.png') });
    await userContext.close();

    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 1080 }
    });
    const adminPage = await adminContext.newPage();
    await prepareSession(adminPage, adminSession);
    await adminPage.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
    await waitStable(adminPage);
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
