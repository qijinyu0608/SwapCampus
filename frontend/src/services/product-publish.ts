import { apiClient } from './api';

export type ProductPublishPayload = {
  title: string;
  description: string;
  price: number;
  category?: string;
  condition: string;
  tags: string[];
  imageUrls?: string[];
  confirmPriceReview?: boolean;
};

export type ProductPublishPriceReview = {
  verdict: 'PASS' | 'HIGH' | 'LOW';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  suggestedPriceMin: number | null;
  suggestedPriceMax: number | null;
  requiresConfirmation: boolean;
};

export type ProductPublishReview = {
  provider: string;
  model: string;
  status: 'enabled' | 'disabled' | 'failed';
  decision: 'APPROVED' | 'REJECTED' | 'REVIEW';
  shouldBlock: boolean;
  selectedCategory: string;
  reason: string;
  issues: string[];
  priceReview?: ProductPublishPriceReview | null;
};

export type ProductPublishSuccessResponse = {
  id: number;
  title: string;
  status: string;
  review?: ProductPublishReview | null;
};

export type UploadedImageAsset = {
  objectKey: string;
  url: string;
  width: number;
  height: number;
  mimeType: string;
  size: number;
};

export async function createProductWithImages(payload: ProductPublishPayload) {
  const response = await apiClient.post('/products', payload);
  return response.data as ProductPublishSuccessResponse;
}

export async function updateProductWithImages(id: number, payload: ProductPublishPayload) {
  const response = await apiClient.patch(`/products/${id}`, payload);
  return response.data as ProductPublishSuccessResponse;
}

export async function uploadProductImageAsset(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'product');

  const response = await apiClient.post<UploadedImageAsset>('/media/images', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
}
