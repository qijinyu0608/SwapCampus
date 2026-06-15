import { Injectable, Logger } from '@nestjs/common';
import { CampusServiceCategory } from '@prisma/client';
import { PRODUCT_CATEGORY_NAMES, type ProductCategoryName } from '../products/product-categories';

type ReviewDecision = 'APPROVED' | 'REJECTED' | 'REVIEW';

export type LlmReviewStatus = 'enabled' | 'disabled' | 'failed';

export type ProductPublishingReviewInput = {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  tags: string[];
  imageUrls: string[];
};

export type CampusServicePublishingReviewInput = {
  intent?: string;
  pattern?: string;
  title: string;
  category?: CampusServiceCategory;
  description: string;
  amount?: number;
  priceMode?: string;
  locationMode?: string;
  locationNote?: string | null;
  estimatedMinutes: number;
  urgency?: string;
  fulfillmentMode?: string;
  itemCount?: number;
  maxTotalOrders?: number | null;
  maxConcurrentOrders?: number;
  trustNote?: string | null;
  imageUrls: string[];
};

export type ProductPublishingReviewResult = {
  provider: 'deepseek';
  model: string;
  status: LlmReviewStatus;
  decision: ReviewDecision;
  shouldBlock: boolean;
  selectedCategory: ProductCategoryName;
  reason: string;
  issues: string[];
  priceReview: ProductPriceReviewResult | null;
};

export type CampusServicePublishingReviewResult = {
  provider: 'deepseek';
  model: string;
  status: LlmReviewStatus;
  decision: ReviewDecision;
  shouldBlock: boolean;
  selectedCategory: CampusServiceCategory;
  reason: string;
  issues: string[];
};

type DeepSeekProductStructuredOutput = {
  decision?: ReviewDecision;
  selectedCategory?: string;
  reason?: string;
  issues?: string[];
  priceReview?: {
    verdict?: 'PASS' | 'HIGH' | 'LOW';
    confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
    suggestedPriceMin?: number | null;
    suggestedPriceMax?: number | null;
    reason?: string;
  };
};

type DeepSeekCampusServiceStructuredOutput = {
  decision?: ReviewDecision;
  selectedCategory?: string;
  reason?: string;
  issues?: string[];
};

const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
const FALLBACK_DEEPSEEK_MODELS = ['deepseek-chat'];

export type ProductPriceReviewResult = {
  verdict: 'PASS' | 'HIGH' | 'LOW';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  suggestedPriceMin: number | null;
  suggestedPriceMax: number | null;
  requiresConfirmation: boolean;
};

function normalizeDecision(value: unknown): ReviewDecision {
  return value === 'APPROVED' || value === 'REJECTED' || value === 'REVIEW'
    ? value
    : 'REVIEW';
}

function normalizeIssues(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeReason(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeProductCategory(value: unknown): ProductCategoryName {
  return PRODUCT_CATEGORY_NAMES.includes(value as ProductCategoryName)
    ? (value as ProductCategoryName)
    : '其他';
}

function normalizeCampusServiceCategory(value: unknown): CampusServiceCategory {
  const allowed = Object.values(CampusServiceCategory);
  return allowed.includes(value as CampusServiceCategory)
    ? (value as CampusServiceCategory)
    : CampusServiceCategory.OTHER;
}

function normalizeConfidence(value: unknown): ProductPriceReviewResult['confidence'] {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH'
    ? value
    : 'LOW';
}

function normalizeSuggestedPrice(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Number(value.toFixed(2))
    : null;
}

function normalizePriceReview(value: unknown): ProductPriceReviewResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const review = value as DeepSeekProductStructuredOutput['priceReview'];
  const verdict = review?.verdict === 'HIGH' || review?.verdict === 'LOW' || review?.verdict === 'PASS'
    ? review.verdict
    : 'PASS';

  return {
    verdict,
    confidence: normalizeConfidence(review?.confidence),
    reason: normalizeReason(review?.reason, '价格看起来基本合理'),
    suggestedPriceMin: normalizeSuggestedPrice(review?.suggestedPriceMin),
    suggestedPriceMax: normalizeSuggestedPrice(review?.suggestedPriceMax),
    requiresConfirmation: verdict !== 'PASS'
  };
}

@Injectable()
export class PublishingReviewService {
  private readonly logger = new Logger(PublishingReviewService.name);

  isEnabled() {
    return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
  }

  private getBaseUrl() {
    return (process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_DEEPSEEK_BASE_URL).replace(/\/$/, '');
  }

  private getConfiguredModel() {
    return process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY?.trim()}`
    };
  }

  private async callDeepSeek(messages: Array<{ role: 'system' | 'user'; content: string }>) {
    const models = [this.getConfiguredModel(), ...FALLBACK_DEEPSEEK_MODELS]
      .filter(Boolean)
      .filter((model, index, list) => list.indexOf(model) === index);
    let lastError: Error | null = null;

    for (const model of models) {
      try {
        const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            model,
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages
          })
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(`DeepSeek API ${response.status}: ${detail}`);
        }

        const payload = await response.json() as {
          choices?: Array<{
            message?: {
              content?: string | null;
            };
          }>;
        };
        const content = payload.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('DeepSeek API returned empty content');
        }

        return {
          model,
          content
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`deepseek review failed with model ${model}: ${lastError.message}`);
      }
    }

    throw lastError ?? new Error('DeepSeek review failed');
  }

  async reviewProduct(input: ProductPublishingReviewInput): Promise<ProductPublishingReviewResult> {
    const configuredModel = this.getConfiguredModel();

    if (!this.isEnabled()) {
      return {
        provider: 'deepseek',
        model: configuredModel,
        status: 'disabled',
        decision: 'APPROVED',
        shouldBlock: false,
        selectedCategory: normalizeProductCategory(input.category),
        reason: '未配置 DeepSeek API，已跳过 LLM 审查',
        issues: [],
        priceReview: null
      };
    }

    try {
      const result = await this.callDeepSeek([
        {
          role: 'system',
          content: [
            '你是校园二手与校园服务平台的发布前审查助手。',
            '你只输出 JSON，不要输出任何额外文本。',
            '任务一：判断该商品是否可以发布，decision 只能是 APPROVED、REJECTED、REVIEW。',
            '任务二：必须从给定商品分类中选择一个最合适的 selectedCategory。',
            '任务三：结合商品标题、描述、分类、成色与价格，判断价格是否明显偏高或偏低；只有在你有较强把握时才标记异常。',
            '如果内容涉及违法违规、代写代考、账号交易、药品烟酒、刀具、明显不适合校园二手平台的内容，应优先 REJECTED。',
            '如果内容有明显歧义、风险较高或分类判断不稳，可以返回 REVIEW。',
            '输出 JSON 字段固定为：decision, selectedCategory, reason, issues, priceReview。issues 必须是字符串数组。',
            'priceReview 必须是对象，字段固定为：verdict, confidence, suggestedPriceMin, suggestedPriceMax, reason。',
            'verdict 只能是 PASS、HIGH、LOW；confidence 只能是 LOW、MEDIUM、HIGH。',
            '如果价格没有明显问题，verdict 返回 PASS，suggestedPriceMin 和 suggestedPriceMax 返回 null。'
          ].join('\n')
        },
        {
          role: 'user',
          content: JSON.stringify({
            allowedCategories: PRODUCT_CATEGORY_NAMES,
            listing: input
          })
        }
      ]);

      const parsed = JSON.parse(result.content) as DeepSeekProductStructuredOutput;
      const decision = normalizeDecision(parsed.decision);
      const selectedCategory = normalizeProductCategory(parsed.selectedCategory ?? input.category);
      const priceReview = normalizePriceReview(parsed.priceReview);
      return {
        provider: 'deepseek',
        model: result.model,
        status: 'enabled',
        decision,
        shouldBlock: decision === 'REJECTED',
        selectedCategory,
        reason: normalizeReason(parsed.reason, 'LLM 审查完成'),
        issues: normalizeIssues(parsed.issues),
        priceReview
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`product publishing review fallback: ${detail}`);
      return {
        provider: 'deepseek',
        model: configuredModel,
        status: 'failed',
        decision: 'REVIEW',
        shouldBlock: false,
        selectedCategory: normalizeProductCategory(input.category),
        reason: 'LLM 审查调用失败，已回退为仅使用本地规则',
        issues: [],
        priceReview: null
      };
    }
  }

  async reviewCampusService(input: CampusServicePublishingReviewInput): Promise<CampusServicePublishingReviewResult> {
    const configuredModel = this.getConfiguredModel();
    const fallbackCategory = normalizeCampusServiceCategory(input.category);

    if (!this.isEnabled()) {
      return {
        provider: 'deepseek',
        model: configuredModel,
        status: 'disabled',
        decision: 'APPROVED',
        shouldBlock: false,
        selectedCategory: fallbackCategory,
        reason: '未配置 DeepSeek API，已跳过 LLM 审查',
        issues: []
      };
    }

    try {
      const result = await this.callDeepSeek([
        {
          role: 'system',
          content: [
            '你是校园服务发布前审查助手。',
            '你只输出 JSON，不要输出任何额外文本。',
            '判断该校园服务是否可以发布，decision 只能是 APPROVED、REJECTED、REVIEW。',
            '必须从给定服务分类中选择一个最合适的 selectedCategory。',
            '如果内容涉及违法违规、代写代考、账号交易、药品烟酒、刀具、明显不适合校园服务平台的内容，应优先 REJECTED。',
            '如果服务描述存在较高风险、时效与能力表达失真、或内容明显不清晰，可以返回 REVIEW。',
            '输出 JSON 字段固定为：decision, selectedCategory, reason, issues。issues 必须是字符串数组。'
          ].join('\n')
        },
        {
          role: 'user',
          content: JSON.stringify({
            allowedCategories: Object.values(CampusServiceCategory),
            listing: input
          })
        }
      ]);

      const parsed = JSON.parse(result.content) as DeepSeekCampusServiceStructuredOutput;
      const decision = normalizeDecision(parsed.decision);
      const selectedCategory = normalizeCampusServiceCategory(parsed.selectedCategory ?? input.category);
      return {
        provider: 'deepseek',
        model: result.model,
        status: 'enabled',
        decision,
        shouldBlock: decision === 'REJECTED',
        selectedCategory,
        reason: normalizeReason(parsed.reason, 'LLM 审查完成'),
        issues: normalizeIssues(parsed.issues)
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`campus service publishing review fallback: ${detail}`);
      return {
        provider: 'deepseek',
        model: configuredModel,
        status: 'failed',
        decision: 'REVIEW',
        shouldBlock: false,
        selectedCategory: fallbackCategory,
        reason: 'LLM 审查调用失败，已回退为仅使用本地规则',
        issues: []
      };
    }
  }
}
