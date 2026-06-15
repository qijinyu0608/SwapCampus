import {
  COMMERCE_SYNC_BATCH_SIZE,
  COMMERCE_SYNC_PROCESSING_TIMEOUT_MS,
  COMMERCE_SYNC_RETRY_DELAYS_MS,
  getCommerceOutboxConsumerConfig,
  getSearchOutboxConsumerConfig,
  SEARCH_INDEX_BATCH_SIZE,
  SEARCH_INDEX_PROCESSING_TIMEOUT_MS,
  SEARCH_INDEX_RETRY_DELAYS_MS
} from './outbox.types';

describe('outbox consumer config', () => {
  it('should use search defaults when env is missing', () => {
    const config = getSearchOutboxConsumerConfig({} as NodeJS.ProcessEnv);

    expect(config).toMatchObject({
      enabled: true,
      pollIntervalMs: 3000,
      batchSize: SEARCH_INDEX_BATCH_SIZE,
      processingTimeoutMs: SEARCH_INDEX_PROCESSING_TIMEOUT_MS,
      retryDelaysMs: [...SEARCH_INDEX_RETRY_DELAYS_MS],
      maxRetries: SEARCH_INDEX_RETRY_DELAYS_MS.length
    });
  });

  it('should allow search worker to customize polling and retry config', () => {
    const config = getSearchOutboxConsumerConfig({
      SEARCH_INDEX_OUTBOX_ENABLED: 'true',
      SEARCH_INDEX_OUTBOX_POLL_MS: '1500',
      SEARCH_INDEX_OUTBOX_BATCH_SIZE: '8',
      SEARCH_INDEX_OUTBOX_PROCESSING_TIMEOUT_MS: '90000',
      SEARCH_INDEX_OUTBOX_RETRY_DELAYS_MS: '1000,2000,5000'
    } as NodeJS.ProcessEnv);

    expect(config).toMatchObject({
      enabled: true,
      pollIntervalMs: 1500,
      batchSize: 8,
      processingTimeoutMs: 90000,
      retryDelaysMs: [1000, 2000, 5000],
      maxRetries: 3
    });
  });

  it('should fall back to search defaults for invalid values', () => {
    const config = getSearchOutboxConsumerConfig({
      SEARCH_INDEX_OUTBOX_ENABLED: 'false',
      SEARCH_INDEX_OUTBOX_POLL_MS: '0',
      SEARCH_INDEX_OUTBOX_BATCH_SIZE: '-1',
      SEARCH_INDEX_OUTBOX_PROCESSING_TIMEOUT_MS: 'abc',
      SEARCH_INDEX_OUTBOX_RETRY_DELAYS_MS: ' , -1, nope '
    } as NodeJS.ProcessEnv);

    expect(config).toMatchObject({
      enabled: false,
      pollIntervalMs: 3000,
      batchSize: SEARCH_INDEX_BATCH_SIZE,
      processingTimeoutMs: SEARCH_INDEX_PROCESSING_TIMEOUT_MS,
      retryDelaysMs: [...SEARCH_INDEX_RETRY_DELAYS_MS],
      maxRetries: SEARCH_INDEX_RETRY_DELAYS_MS.length
    });
  });

  it('should disable commerce consumer for backend when COMMERCE_SYNC_ENABLED is false', () => {
    const config = getCommerceOutboxConsumerConfig({
      COMMERCE_SYNC_ENABLED: 'false'
    } as NodeJS.ProcessEnv);

    expect(config.enabled).toBe(false);
  });

  it('should allow commerce worker to customize polling and retry config', () => {
    const config = getCommerceOutboxConsumerConfig({
      COMMERCE_SYNC_ENABLED: 'true',
      COMMERCE_SYNC_OUTBOX_POLL_MS: '1500',
      COMMERCE_SYNC_OUTBOX_BATCH_SIZE: '8',
      COMMERCE_SYNC_OUTBOX_PROCESSING_TIMEOUT_MS: '90000',
      COMMERCE_SYNC_OUTBOX_RETRY_DELAYS_MS: '1000,2000,5000'
    } as NodeJS.ProcessEnv);

    expect(config).toMatchObject({
      enabled: true,
      pollIntervalMs: 1500,
      batchSize: 8,
      processingTimeoutMs: 90000,
      retryDelaysMs: [1000, 2000, 5000],
      maxRetries: 3
    });
  });

  it('should fall back to commerce defaults for invalid values', () => {
    const config = getCommerceOutboxConsumerConfig({
      COMMERCE_SYNC_ENABLED: 'true',
      COMMERCE_SYNC_OUTBOX_POLL_MS: '-10',
      COMMERCE_SYNC_OUTBOX_BATCH_SIZE: '0',
      COMMERCE_SYNC_OUTBOX_PROCESSING_TIMEOUT_MS: 'NaN',
      COMMERCE_SYNC_OUTBOX_RETRY_DELAYS_MS: ''
    } as NodeJS.ProcessEnv);

    expect(config).toMatchObject({
      enabled: true,
      pollIntervalMs: 3000,
      batchSize: COMMERCE_SYNC_BATCH_SIZE,
      processingTimeoutMs: COMMERCE_SYNC_PROCESSING_TIMEOUT_MS,
      retryDelaysMs: [...COMMERCE_SYNC_RETRY_DELAYS_MS],
      maxRetries: COMMERCE_SYNC_RETRY_DELAYS_MS.length
    });
  });
});
