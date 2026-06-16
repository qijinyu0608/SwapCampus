import { BadRequestException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { MediaController } from './media.controller';

describe('MediaController', () => {
  function createController() {
    const mediaService = {
      uploadImage: jest.fn().mockResolvedValue({ url: '/image.jpg' }),
      uploadMessageAttachment: jest.fn().mockResolvedValue({ url: '/attachment.mp4' }),
      getObject: jest.fn().mockResolvedValue({
        stream: Readable.from('ok'),
        contentType: 'image/jpeg',
        size: 2
      })
    } as any;
    return { controller: new MediaController(mediaService), mediaService };
  }

  it('uploads media and streams file content', async () => {
    const { controller, mediaService } = createController();
    const user = { id: 7 } as any;
    const image = { buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'a.jpg' } as any;
    const attachment = { buffer: Buffer.from('video'), mimetype: 'video/mp4', originalname: 'a.mp4' } as any;
    const response = { setHeader: jest.fn() } as any;

    await controller.uploadImage(image, { purpose: 'avatar' } as any, user);
    await controller.uploadMessageAttachment(attachment, user);
    await controller.getMediaFile('file-key', response, {} as any);

    expect(mediaService.uploadImage).toHaveBeenCalledWith(expect.objectContaining({
      mimeType: 'image/jpeg',
      originalName: 'a.jpg',
      ownerId: 7
    }));
    expect(mediaService.uploadMessageAttachment).toHaveBeenCalledWith(expect.objectContaining({
      mimeType: 'video/mp4',
      originalName: 'a.mp4',
      ownerId: 7
    }));
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Length', '2');
  });

  it('rejects missing user and missing object key', async () => {
    const { controller } = createController();
    const file = { buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'a.jpg' } as any;
    await expect(controller.uploadImage(file, { purpose: 'avatar' } as any, undefined as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.uploadMessageAttachment(file, undefined as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getMediaFile('', { setHeader: jest.fn() } as any, {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
