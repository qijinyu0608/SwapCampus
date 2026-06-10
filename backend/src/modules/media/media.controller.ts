import { BadRequestException, Body, Controller, Get, Header, Inject, ParseFilePipeBuilder, Post, Query, Req, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import type { Response } from 'express';
import type { Express } from 'express';
import type { SessionRequest } from '../auth/supertokens.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { MEDIA_IMAGE_MIME_TYPES, MEDIA_PURPOSES, MEDIA_UPLOAD_PROFILES } from './media.constants';
import { MediaService } from './media.service';
import { UploadImageDto } from './dto/upload-image.dto';

@Controller('media')
export class MediaController {
  constructor(
    @Inject(MediaService)
    private readonly mediaService: MediaService
  ) {}

  @Post('images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 8 * 1024 * 1024
    }
  }))
  async uploadImage(
    @UploadedFile(new ParseFilePipeBuilder()
      .addFileTypeValidator({ fileType: new RegExp(MEDIA_IMAGE_MIME_TYPES.join('|').replace(/\//g, '\\/')) })
      .addMaxSizeValidator({ maxSize: 8 * 1024 * 1024 })
      .build({ fileIsRequired: true })) file: Express.Multer.File,
    @Body() payload: UploadImageDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    if (!user?.id) {
      throw new BadRequestException('请先登录');
    }

    const purpose = payload.purpose ?? MEDIA_PURPOSES.AVATAR;
    const profile = MEDIA_UPLOAD_PROFILES[purpose];
    const asset = await this.mediaService.uploadImage({
      fileBuffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      purpose,
      ownerId: user.id,
      circularCrop: profile.circularCrop,
      maxWidth: profile.maxWidth,
      maxHeight: profile.maxHeight
    });

    return asset;
  }

  @Get('files')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async getMediaFile(
    @Query('key') objectKey: string,
    @Res({ passthrough: true }) response: Response,
    @Req() _request?: SessionRequest
  ) {
    if (!objectKey?.trim()) {
      throw new BadRequestException('缺少文件标识');
    }

    const file = await this.mediaService.getObject(objectKey);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Content-Length', String(file.size));
    return new StreamableFile(file.stream);
  }
}
