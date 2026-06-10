import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { Client as MinioClient } from 'minio';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { MEDIA_DEFAULT_MAX_UPLOAD_SIZE, MEDIA_IMAGE_MIME_TYPES, type MediaPurpose } from './media.constants';
import type { UploadImageInput, UploadedImageAsset } from './media.types';

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim() || fallback;
  if (!value) {
    throw new InternalServerErrorException(`缺少环境变量 ${name}`);
  }

  return value;
}

function getBucketName() {
  return requireEnv('MINIO_BUCKET', 'swapcampus');
}

function getPublicBaseUrl() {
  const apiDomain = requireEnv('API_DOMAIN', 'http://127.0.0.1:3001');
  return `${apiDomain.replace(/\/$/, '')}/api/media/files`;
}

function buildObjectKey(params: { purpose: MediaPurpose; ownerId: number; extension: string }) {
  const date = new Date();
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${params.purpose}/${params.ownerId}/${yyyy}/${mm}/${randomUUID()}${params.extension}`;
}

function getExtensionFromMimeType(mimeType: string) {
  if (mimeType === 'image/png') {
    return '.png';
  }
  if (mimeType === 'image/webp') {
    return '.webp';
  }

  return '.jpg';
}

@Injectable()
export class MediaService {
  private readonly bucketName = getBucketName();
  private readonly publicBaseUrl = getPublicBaseUrl();
  private readonly minioClient: MinioClient;
  private bucketReadyPromise: Promise<void> | null = null;

  constructor() {
    this.minioClient = new MinioClient({
      endPoint: requireEnv('MINIO_ENDPOINT', 'minio'),
      port: Number(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: requireEnv('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: requireEnv('MINIO_SECRET_KEY', 'minioadmin')
    });
  }

  private async ensureBucketReady() {
    if (!this.bucketReadyPromise) {
      this.bucketReadyPromise = (async () => {
        const exists = await this.minioClient.bucketExists(this.bucketName);
        if (!exists) {
          await this.minioClient.makeBucket(this.bucketName);
        }
      })();
    }

    await this.bucketReadyPromise;
  }

  private assertValidInput(input: UploadImageInput) {
    if (!MEDIA_IMAGE_MIME_TYPES.includes(input.mimeType as (typeof MEDIA_IMAGE_MIME_TYPES)[number])) {
      throw new BadRequestException('仅支持 JPG、PNG、WEBP 图片');
    }

    if (!input.fileBuffer?.length) {
      throw new BadRequestException('图片内容不能为空');
    }

    if (input.fileBuffer.length > MEDIA_DEFAULT_MAX_UPLOAD_SIZE) {
      throw new BadRequestException('图片大小不能超过 8MB');
    }
  }

  private async transformImage(input: UploadImageInput) {
    this.assertValidInput(input);

    let pipeline = sharp(input.fileBuffer, { failOn: 'error' }).rotate();
    const metadata = await pipeline.metadata();

    if (!metadata.width || !metadata.height) {
      throw new BadRequestException('无法识别图片尺寸');
    }

    const extension = input.circularCrop ? '.png' : getExtensionFromMimeType(input.mimeType);
    const targetMimeType = input.circularCrop ? 'image/png' : input.mimeType;
    const maxWidth = input.maxWidth ?? (input.purpose === 'avatar' ? 1024 : 1800);
    const maxHeight = input.maxHeight ?? (input.purpose === 'avatar' ? 1024 : 1800);

    pipeline = pipeline.resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true
    });

    if (input.circularCrop) {
      const circleSize = Math.min(maxWidth, maxHeight, metadata.width, metadata.height);
      const svgMask = Buffer.from(
        `<svg width="${circleSize}" height="${circleSize}"><circle cx="${circleSize / 2}" cy="${circleSize / 2}" r="${circleSize / 2}" fill="white"/></svg>`
      );
      pipeline = pipeline
        .resize(circleSize, circleSize, { fit: 'cover', position: 'centre' })
        .composite([{ input: svgMask, blend: 'dest-in' }])
        .png();
    } else if (targetMimeType === 'image/png') {
      pipeline = pipeline.png();
    } else if (targetMimeType === 'image/webp') {
      pipeline = pipeline.webp({ quality: 90 });
    } else {
      pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
    }

    const output = await pipeline.toBuffer({ resolveWithObject: true });
    return {
      buffer: output.data,
      info: output.info,
      extension,
      mimeType: targetMimeType
    };
  }

  async uploadImage(input: UploadImageInput): Promise<UploadedImageAsset> {
    const transformed = await this.transformImage(input);
    await this.ensureBucketReady();

    const originalExtension = extname(input.originalName || '').toLowerCase();
    const objectKey = buildObjectKey({
      purpose: input.purpose,
      ownerId: input.ownerId,
      extension: transformed.extension || originalExtension || '.jpg'
    });

    await this.minioClient.putObject(
      this.bucketName,
      objectKey,
      transformed.buffer,
      transformed.buffer.byteLength,
      {
        'Content-Type': transformed.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    );

    return {
      objectKey,
      url: `${this.publicBaseUrl}?key=${encodeURIComponent(objectKey)}`,
      width: transformed.info.width ?? 0,
      height: transformed.info.height ?? 0,
      mimeType: transformed.mimeType,
      size: transformed.buffer.byteLength
    };
  }

  async getObject(objectKey: string) {
    await this.ensureBucketReady();
    try {
      const stat = await this.minioClient.statObject(this.bucketName, objectKey);
      const stream = await this.minioClient.getObject(this.bucketName, objectKey);
      return {
        stream,
        contentType: typeof stat.metaData?.['content-type'] === 'string' ? stat.metaData['content-type'] : 'application/octet-stream',
        size: stat.size
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Not Found') || message.includes('does not exist') || message.includes('NoSuchKey')) {
        throw new NotFoundException('文件不存在');
      }

      throw error;
    }
  }
}
