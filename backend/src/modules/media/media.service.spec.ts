import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { MediaService } from './media.service';

describe('MediaService', () => {
  const originalEnv = {
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
    MINIO_PORT: process.env.MINIO_PORT,
    MINIO_USE_SSL: process.env.MINIO_USE_SSL,
    MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
    MINIO_BUCKET: process.env.MINIO_BUCKET,
    API_DOMAIN: process.env.API_DOMAIN
  };

  beforeEach(() => {
    process.env.MINIO_ENDPOINT = '127.0.0.1';
    process.env.MINIO_PORT = '9000';
    process.env.MINIO_USE_SSL = 'false';
    process.env.MINIO_ACCESS_KEY = 'minioadmin';
    process.env.MINIO_SECRET_KEY = 'minioadmin';
    process.env.MINIO_BUCKET = 'swapcampus-test';
    process.env.API_DOMAIN = 'http://127.0.0.1:3001';
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  function createService() {
    const service = new MediaService();
    const minioClient = {
      bucketExists: jest.fn().mockResolvedValue(true),
      makeBucket: jest.fn().mockResolvedValue(undefined),
      putObject: jest.fn().mockResolvedValue(undefined),
      statObject: jest.fn().mockResolvedValue({
        metaData: { 'content-type': 'image/jpeg' },
        size: 12
      }),
      getObject: jest.fn().mockResolvedValue(Readable.from('hello'))
    };
    (service as any).minioClient = minioClient;
    return { service, minioClient };
  }

  it('uploads image assets and message video attachments', async () => {
    const { service, minioClient } = createService();
    const image = await service.uploadImage({
      fileBuffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0pNZYAAAAASUVORK5CYII=',
        'base64'
      ),
      mimeType: 'image/png',
      originalName: 'avatar.png',
      purpose: 'avatar',
      ownerId: 7,
      circularCrop: true,
      maxWidth: 128,
      maxHeight: 128
    });
    expect(image.url).toContain('/api/media/files?key=');
    expect(image.mimeType).toBe('image/png');
    expect(minioClient.putObject).toHaveBeenCalledTimes(1);

    const attachment = await service.uploadMessageAttachment({
      fileBuffer: Buffer.from('video-data'),
      mimeType: 'video/mp4',
      originalName: 'clip.mp4',
      ownerId: 7
    });
    expect(attachment.mimeType).toBe('video/mp4');
    expect(minioClient.putObject).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid media payloads', async () => {
    const { service } = createService();
    await expect(service.uploadImage({
      fileBuffer: Buffer.alloc(0),
      mimeType: 'image/gif',
      purpose: 'avatar',
      ownerId: 1
    } as any)).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.uploadMessageAttachment({
      fileBuffer: Buffer.alloc(0),
      mimeType: 'application/pdf',
      ownerId: 1
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns stored objects and maps missing file errors', async () => {
    const { service, minioClient } = createService();
    await expect(service.getObject('abc')).resolves.toEqual(expect.objectContaining({
      contentType: 'image/jpeg',
      size: 12
    }));

    minioClient.statObject.mockRejectedValueOnce(new Error('Not Found'));
    await expect(service.getObject('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
