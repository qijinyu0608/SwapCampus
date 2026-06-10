import type { MediaPurpose } from './media.constants';

export type UploadImageInput = {
  fileBuffer: Buffer;
  mimeType: string;
  originalName?: string;
  purpose: MediaPurpose;
  ownerId: number;
  circularCrop?: boolean;
  maxWidth?: number;
  maxHeight?: number;
};

export type UploadedImageAsset = {
  objectKey: string;
  url: string;
  width: number;
  height: number;
  mimeType: string;
  size: number;
};
