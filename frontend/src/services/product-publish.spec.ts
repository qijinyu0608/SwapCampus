import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProductWithImages,
  updateProductWithImages,
  uploadProductImageAsset,
  type ProductPublishPayload
} from './product-publish';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  patch: vi.fn()
}));

vi.mock('./api', () => ({
  apiClient: {
    post: mocks.post,
    patch: mocks.patch
  }
}));

describe('product publish service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates products with the publish payload', async () => {
    const payload: ProductPublishPayload = {
      title: '高数教材',
      description: '九成新，带笔记',
      price: 18,
      category: '教材资料',
      condition: '九成新',
      tags: ['教材', '笔记'],
      imageUrls: ['/book.png']
    };

    mocks.post.mockResolvedValue({
      data: {
        id: 18,
        title: '高数教材',
        status: 'ON_SALE'
      }
    });

    await expect(createProductWithImages(payload)).resolves.toEqual({
      id: 18,
      title: '高数教材',
      status: 'ON_SALE'
    });
    expect(mocks.post).toHaveBeenCalledWith('/products', payload);
  });

  it('updates products with the publish payload', async () => {
    const payload: ProductPublishPayload = {
      title: '高数教材',
      description: '已补充更多图片',
      price: 20,
      condition: '九成新',
      tags: ['教材']
    };

    mocks.patch.mockResolvedValue({
      data: {
        id: 18,
        title: '高数教材',
        status: 'REVIEWING'
      }
    });

    await expect(updateProductWithImages(18, payload)).resolves.toEqual({
      id: 18,
      title: '高数教材',
      status: 'REVIEWING'
    });
    expect(mocks.patch).toHaveBeenCalledWith('/products/18', payload);
  });

  it('uploads product image assets with multipart form data', async () => {
    const file = new File(['image'], 'book.png', { type: 'image/png' });

    mocks.post.mockResolvedValue({
      data: {
        objectKey: 'product/book.png',
        url: 'https://cdn.swapcampus.test/product/book.png',
        width: 640,
        height: 480,
        mimeType: 'image/png',
        size: 2048
      }
    });

    await expect(uploadProductImageAsset(file)).resolves.toEqual({
      objectKey: 'product/book.png',
      url: 'https://cdn.swapcampus.test/product/book.png',
      width: 640,
      height: 480,
      mimeType: 'image/png',
      size: 2048
    });

    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post.mock.calls[0]?.[0]).toBe('/media/images');
    expect(mocks.post.mock.calls[0]?.[2]).toEqual({
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    const formData = mocks.post.mock.calls[0]?.[1] as FormData;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('file')).toBe(file);
    expect(formData.get('purpose')).toBe('product');
  });
});
