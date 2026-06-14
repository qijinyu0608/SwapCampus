export const MEDIA_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MEDIA_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export const MEDIA_MESSAGE_MIME_TYPES = [...MEDIA_IMAGE_MIME_TYPES, ...MEDIA_VIDEO_MIME_TYPES] as const;

export const MEDIA_DEFAULT_MAX_UPLOAD_SIZE = 8 * 1024 * 1024;
export const MEDIA_MESSAGE_MAX_UPLOAD_SIZE = 25 * 1024 * 1024;

export const MEDIA_PURPOSES = {
  AVATAR: 'avatar',
  PRODUCT: 'product',
  MESSAGE: 'message'
} as const;

export type MediaPurpose = (typeof MEDIA_PURPOSES)[keyof typeof MEDIA_PURPOSES];

export const MEDIA_UPLOAD_PROFILES: Record<MediaPurpose, {
  circularCrop: boolean;
  maxWidth: number;
  maxHeight: number;
}> = {
  [MEDIA_PURPOSES.AVATAR]: {
    circularCrop: true,
    maxWidth: 512,
    maxHeight: 512
  },
  [MEDIA_PURPOSES.PRODUCT]: {
    circularCrop: false,
    maxWidth: 1800,
    maxHeight: 1800
  },
  [MEDIA_PURPOSES.MESSAGE]: {
    circularCrop: false,
    maxWidth: 1800,
    maxHeight: 1800
  }
};
