import {
  CampusServiceCategory,
  CampusServiceIntent,
  CampusServiceListingStatus,
  CampusServiceLocationMode,
  OrderStatus,
  ProductStatus,
  UserRole
} from '@prisma/client';
import { buildDemoSeedPlan } from './demo-seed';
import { formatProductConditionValue, parseProductConditionValue } from '../src/modules/products/product-conditions';

describe('demo seed plan', () => {
  it('should build a substantial demo dataset with products and campus services', () => {
    const plan = buildDemoSeedPlan(new Date('2026-06-14T08:00:00.000Z'));

    expect(plan.users.length).toBeGreaterThanOrEqual(43);
    expect(plan.products.length).toBeGreaterThanOrEqual(28);
    expect(plan.campusServices.length).toBeGreaterThanOrEqual(46);
    expect(plan.productOrders.length).toBeGreaterThanOrEqual(6);
    expect(plan.campusServiceOrders.length).toBeGreaterThanOrEqual(4);
    expect(plan.reports.length).toBeGreaterThanOrEqual(4);
  });

  it('should include both admin and user accounts with varied credit levels', () => {
    const plan = buildDemoSeedPlan();
    const roles = new Set(plan.users.map((item) => item.role));
    const creditScores = plan.users.map((item) => item.creditScore);

    expect(roles.has(UserRole.ADMIN)).toBe(true);
    expect(roles.has(UserRole.USER)).toBe(true);
    expect(Math.max(...creditScores)).toBeGreaterThan(90);
    expect(Math.min(...creditScores)).toBeLessThan(70);
  });

  it('should generate product seeds with valid formatted conditions and mixed statuses', () => {
    const plan = buildDemoSeedPlan();
    const conditions = plan.products.map((item) => formatProductConditionValue(item.conditionScore));
    const parsed = conditions.map((item) => parseProductConditionValue(item));
    const statuses = new Set(plan.products.map((item) => item.status));

    expect(parsed.every((item) => item !== null)).toBe(true);
    expect(statuses.has(ProductStatus.ON_SALE)).toBe(true);
    expect(statuses.has(ProductStatus.PENDING)).toBe(true);
    expect(statuses.has(ProductStatus.SOLD)).toBe(true);
  });

  it('should generate campus services covering request and offer intents plus all location modes in use', () => {
    const plan = buildDemoSeedPlan();
    const intents = new Set(plan.campusServices.map((item) => item.intent));
    const locationModes = new Set(plan.campusServices.map((item) => item.locationMode));
    const statuses = new Set(plan.campusServices.map((item) => item.status));
    const categories = new Set(plan.campusServices.map((item) => item.category));
    const ownerIndexes = new Set(plan.campusServices.map((item) => item.ownerIndex));

    expect(intents).toEqual(new Set([CampusServiceIntent.REQUEST, CampusServiceIntent.OFFER]));
    expect(locationModes.has(CampusServiceLocationMode.ONLINE)).toBe(true);
    expect(locationModes.has(CampusServiceLocationMode.ON_SITE)).toBe(true);
    expect(locationModes.has(CampusServiceLocationMode.FLEXIBLE)).toBe(true);
    expect(statuses.has(CampusServiceListingStatus.OPEN)).toBe(true);
    expect(statuses.has(CampusServiceListingStatus.BUSY)).toBe(true);
    expect(statuses.has(CampusServiceListingStatus.PAUSED)).toBe(true);
    expect(categories.has(CampusServiceCategory.HELP)).toBe(true);
    expect(ownerIndexes).toEqual(new Set(Array.from({ length: plan.users.length - 1 }, (_value, index) => index + 1)));
  });

  it('should include product order states suitable for order, review, and message pages', () => {
    const plan = buildDemoSeedPlan();
    const statuses = new Set(plan.productOrders.map((item) => item.status));

    expect(statuses.has(OrderStatus.PENDING)).toBe(true);
    expect(statuses.has(OrderStatus.IN_PROGRESS)).toBe(true);
    expect(statuses.has(OrderStatus.WAITING_REVIEW)).toBe(true);
    expect(statuses.has(OrderStatus.COMPLETED)).toBe(true);
    expect(statuses.has(OrderStatus.CANCELED)).toBe(true);
  });
});
