import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

export type RemoteProductImageSample = {
  source: string;
  sourceId: string;
  title: string;
  imageUrl: string;
  localImageUrl?: string;
};

const ARTIFACT_FILE = path.resolve(process.cwd(), '../artifacts/generated-data/real-product-samples.json');
const REMOTE_IMAGE_DIR = path.resolve(process.cwd(), '../frontend/public/images/products/remote');
const REMOTE_IMAGE_ROUTE = '/images/products/remote';
const CANDIDATE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif'];

function sanitizeSegment(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'remote';
}

function trimExtension(ext: string) {
  return ext.toLowerCase() === '.jpeg' ? '.jpg' : ext.toLowerCase();
}

function extensionFromContentType(contentType?: string | null) {
  const normalized = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if (normalized === 'image/jpeg') return '.jpg';
  if (normalized === 'image/png') return '.png';
  if (normalized === 'image/webp') return '.webp';
  if (normalized === 'image/gif') return '.gif';
  if (normalized === 'image/svg+xml') return '.svg';
  if (normalized === 'image/avif') return '.avif';
  return null;
}

function extensionFromUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const ext = trimExtension(path.extname(parsed.pathname));
    return CANDIDATE_EXTENSIONS.includes(ext) ? ext : null;
  } catch {
    return null;
  }
}

function hashRemoteUrl(url: string) {
  return createHash('sha1').update(url).digest('hex').slice(0, 16);
}

function buildRemoteImageBaseName(sample: Pick<RemoteProductImageSample, 'source' | 'imageUrl'>) {
  return `${sanitizeSegment(sample.source)}-${hashRemoteUrl(sample.imageUrl).slice(0, 12)}`;
}

function buildRemoteImageRoute(sample: Pick<RemoteProductImageSample, 'source' | 'imageUrl'>, extension: string) {
  return `${REMOTE_IMAGE_ROUTE}/${buildRemoteImageBaseName(sample)}${extension}`;
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findExistingLocalRoute(sample: Pick<RemoteProductImageSample, 'source' | 'imageUrl'>) {
  const baseName = buildRemoteImageBaseName(sample);

  for (const extension of CANDIDATE_EXTENSIONS) {
    const candidate = `${baseName}${extension}`;
    const absolutePath = path.join(REMOTE_IMAGE_DIR, candidate);
    if (await fileExists(absolutePath)) {
      return `${REMOTE_IMAGE_ROUTE}/${candidate}`;
    }
  }

  return null;
}

export async function loadRemoteProductSamples() {
  const content = await fs.readFile(ARTIFACT_FILE, 'utf8');
  const payload = JSON.parse(content) as { samples?: unknown[] };
  const samples = Array.isArray(payload.samples) ? payload.samples : [];

  return samples.filter((sample): sample is RemoteProductImageSample => {
    if (!sample || typeof sample !== 'object') {
      return false;
    }

    const candidate = sample as Record<string, unknown>;
    return typeof candidate.source === 'string'
      && typeof candidate.sourceId === 'string'
      && typeof candidate.title === 'string'
      && typeof candidate.imageUrl === 'string';
  });
}

export async function writeRemoteProductSamples(samples: RemoteProductImageSample[]) {
  const existing = JSON.parse(await fs.readFile(ARTIFACT_FILE, 'utf8')) as Record<string, unknown>;
  const payload = {
    ...existing,
    count: samples.length,
    samples
  };

  await fs.writeFile(ARTIFACT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function parseContentTypeFromHeaders(rawHeaders: string) {
  const matches = [...rawHeaders.matchAll(/^content-type:\s*(.+)$/gim)];
  return matches.length ? matches[matches.length - 1][1].trim() : null;
}

async function downloadWithFetch(url: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let timer: NodeJS.Timeout | null = null;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
      clearTimeout(timer);
      timer = null;
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type'),
        finalUrl: response.url
      };
    } catch (error) {
      if (timer) {
        clearTimeout(timer);
      }
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function downloadWithCurl(url: string) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'swapcampus-img-'));
  const bodyPath = path.join(tempDir, 'body.bin');
  const headersPath = path.join(tempDir, 'headers.txt');

  try {
    const result = spawnSync(
      'curl',
      [
        '-L',
        '--fail',
        '--silent',
        '--show-error',
        '--retry',
        '3',
        '--retry-delay',
        '1',
        '--connect-timeout',
        '10',
        '--max-time',
        '60',
        '-D',
        headersPath,
        '-o',
        bodyPath,
        '-w',
        '%{url_effective}',
        url
      ],
      { encoding: 'utf8' }
    );

    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'curl download failed').trim());
    }

    const [buffer, rawHeaders] = await Promise.all([
      fs.readFile(bodyPath),
      fs.readFile(headersPath, 'utf8')
    ]);

    return {
      buffer,
      contentType: parseContentTypeFromHeaders(rawHeaders),
      finalUrl: result.stdout.trim() || url
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function ensureRemoteProductImageAsset(sample: RemoteProductImageSample) {
  await fs.mkdir(REMOTE_IMAGE_DIR, { recursive: true });

  if (typeof sample.localImageUrl === 'string' && sample.localImageUrl.startsWith(`${REMOTE_IMAGE_ROUTE}/`)) {
    return sample.localImageUrl;
  }

  const existingRoute = await findExistingLocalRoute(sample);
  if (existingRoute) {
    return existingRoute;
  }

  let response;
  try {
    response = await downloadWithFetch(sample.imageUrl);
  } catch {
    response = await downloadWithCurl(sample.imageUrl);
  }

  const extension = extensionFromContentType(response.contentType)
    ?? extensionFromUrl(response.finalUrl)
    ?? extensionFromUrl(sample.imageUrl)
    ?? '.jpg';
  const localRoute = buildRemoteImageRoute(sample, extension);
  const localPath = path.resolve(process.cwd(), `../frontend/public${localRoute}`);

  await fs.writeFile(localPath, response.buffer);
  return localRoute;
}
