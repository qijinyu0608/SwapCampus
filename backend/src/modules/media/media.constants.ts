export const MEDIA_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const MEDIA_DEFAULT_MAX_UPLOAD_SIZE = 8 * 1024 * 1024;

export const MEDIA_PURPOSES = {
  AVATAR: 'avatar',
  PRODUCT: 'product'
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
  }
};
