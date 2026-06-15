import { CampusServiceCategory } from '@prisma/client';
import { PublishingReviewService } from './publishing-review.service';

describe('PublishingReviewService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.test';
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_MODEL;
    global.fetch = originalFetch;
  });

  it('skips llm review when API key is not configured', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const service = new PublishingReviewService();
    await expect(service.reviewProduct({
      title: '键盘',
      description: '机械键盘',
      price: 99,
      category: '数码电子',
      condition: '九成新',
      tags: [],
      imageUrls: []
    })).resolves.toEqual(expect.objectContaining({
      status: 'disabled',
      decision: 'APPROVED',
      selectedCategory: '数码电子',
      priceReview: null
    }));
  });

  it('parses structured product review results', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'REJECTED',
                selectedCategory: '数码电子',
                reason: '违规内容',
                issues: ['账号交易'],
                priceReview: {
                  verdict: 'HIGH',
                  confidence: 'HIGH',
                  suggestedPriceMin: 1,
                  suggestedPriceMax: 5,
                  reason: '账号商品本身不合规，且定价异常'
                }
              })
            }
          }
        ]
      })
    }) as any;

    const service = new PublishingReviewService();
    await expect(service.reviewProduct({
      title: '账号',
      description: '出售账号',
      price: 10,
      category: '其他',
      condition: '全新',
      tags: [],
      imageUrls: []
    })).resolves.toEqual(expect.objectContaining({
      status: 'enabled',
      decision: 'REJECTED',
      shouldBlock: true,
      selectedCategory: '数码电子',
      issues: ['账号交易'],
      priceReview: expect.objectContaining({
        verdict: 'HIGH',
        requiresConfirmation: true,
        suggestedPriceMin: 1,
        suggestedPriceMax: 5
      })
    }));
  });

  it('falls back when llm request fails and reviews campus services', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'server error'
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'server error'
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  decision: 'APPROVED',
                  selectedCategory: CampusServiceCategory.ERRAND,
                  reason: 'ok',
                  issues: []
                })
              }
            }
          ]
        })
      }) as any;

    const service = new PublishingReviewService();
    const productResult = await service.reviewProduct({
      title: '教材',
      description: '高数',
      price: 15,
      category: '教材资料',
      condition: '八成新',
      tags: [],
      imageUrls: []
    });
    expect(productResult).toEqual(expect.objectContaining({
      status: 'failed',
      decision: 'REVIEW',
      selectedCategory: '教材资料',
      priceReview: null
    }));

    const campusResult = await service.reviewCampusService({
      title: '帮拿快递',
      category: CampusServiceCategory.HELP,
      description: '下午可以顺路拿',
      estimatedMinutes: 30,
      imageUrls: []
    });
    expect(campusResult).toEqual(expect.objectContaining({
      status: 'enabled',
      decision: 'APPROVED',
      selectedCategory: CampusServiceCategory.ERRAND
    }));
  });
});
