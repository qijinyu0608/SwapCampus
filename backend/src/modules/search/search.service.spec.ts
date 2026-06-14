import { buildSearchQuery } from './search.service';
import { SearchService } from './search.service';

describe('search query building', () => {
  it('segments Chinese phrases into quoted search tokens', () => {
    expect(buildSearchQuery('电动牙刷')).toBe('"电动牙刷"');
  });

  it('keeps mixed Chinese and alphanumeric search terms', () => {
    expect(buildSearchQuery('电动牙刷 10000mAh')).toBe('"电动牙刷" "10000" "mah"');
  });

  it('uses segmented query when calling Meilisearch', async () => {
    const search = jest.fn().mockResolvedValue({
      hits: [],
      page: 1,
      hitsPerPage: 20,
      totalHits: 0,
      totalPages: 0
    });

    const service: any = Object.create(SearchService.prototype);

    service.ensureReady = jest.fn().mockResolvedValue(undefined);
    service.productsIndex = { search };

    await service.searchProducts({
      q: '电动牙刷 10000mAh',
      page: 1,
      pageSize: 20,
      status: 'ON_SALE',
      sort: 'relevance'
    });

    expect(search).toHaveBeenCalledWith('"电动牙刷" "10000" "mah"', expect.objectContaining({
      matchingStrategy: 'all',
      page: 1,
      hitsPerPage: 20
    }));
  });
});
