import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';

type VendureGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type VendureProductProjection = {
  id: string;
  variantId: string;
};

type VendureCustomerProjection = {
  id: string;
};

type VendureOrderProjection = {
  id: string;
  code: string;
  state: string;
};

type VendureOrderResult = {
  __typename?: string;
  id?: string;
  code?: string;
  state?: string;
  message?: string;
  errorCode?: string;
};

const DEFAULT_LANGUAGE_CODE = 'zh_Hans';
const DEFAULT_PAYMENT_METHOD_CODE = 'swapcampus-offline-payment';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'swapcampus-item';
}

function splitDisplayName(displayName: string) {
  const normalized = displayName.trim();
  if (!normalized) {
    return { firstName: 'SwapCampus', lastName: 'User' };
  }

  if (normalized.length <= 2) {
    return { firstName: normalized, lastName: '同学' };
  }

  return {
    firstName: normalized.slice(0, 1),
    lastName: normalized.slice(1)
  };
}

@Injectable()
export class VendureService {
  private authToken: string | null = process.env.VENDURE_ADMIN_TOKEN || null;
  private authPromise: Promise<string> | null = null;
  private paymentMethodCodePromise: Promise<string> | null = null;

  private get enabled() {
    return process.env.VENDURE_ENABLED !== 'false';
  }

  private get endpoint() {
    return process.env.VENDURE_ADMIN_API_URL || 'http://127.0.0.1:3002/admin-api';
  }

  async ensureProductVariant(product: {
    id: number;
    vendureProductId?: string | null;
    vendureVariantId?: string | null;
    title: string;
    description: string;
    price: unknown;
  }): Promise<VendureProductProjection> {
    this.assertEnabled();
    if (product.vendureProductId && product.vendureVariantId) {
      return {
        id: product.vendureProductId,
        variantId: product.vendureVariantId
      };
    }

    const sku = this.buildSku(product.id);
    const existingVariant = await this.findVariantBySku(sku);
    if (existingVariant) {
      return existingVariant;
    }

    const createdProduct = await this.adminRequest<{
      createProduct: {
        id: string;
      };
    }>(
      `
        mutation CreateProduct($input: CreateProductInput!) {
          createProduct(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          enabled: true,
          translations: [
            {
              languageCode: DEFAULT_LANGUAGE_CODE,
              name: product.title,
              slug: `${slugify(product.title)}-${product.id}`,
              description: product.description || product.title
            }
          ]
        }
      }
    );

    const createdVariants = await this.adminRequest<{
      createProductVariants: Array<{
        id: string;
        productId: string;
      }>;
    }>(
      `
        mutation CreateProductVariants($input: [CreateProductVariantInput!]!) {
          createProductVariants(input: $input) {
            id
            productId
          }
        }
      `,
      {
        input: [
          {
            productId: createdProduct.createProduct.id,
            enabled: true,
            sku,
            price: this.toVendureMoney(product.price),
            stockOnHand: 1,
            trackInventory: 'FALSE',
            translations: [
              {
                languageCode: DEFAULT_LANGUAGE_CODE,
                name: product.title
              }
            ]
          }
        ]
      }
    );

    const variant = createdVariants.createProductVariants[0];
    if (!variant) {
      throw new BadGatewayException('Vendure 商品变体创建失败');
    }

    return {
      id: createdProduct.createProduct.id,
      variantId: variant.id
    };
  }

  async ensureCustomer(user: {
    id: number;
    vendureCustomerId?: string | null;
    displayName: string;
    email: string;
  }): Promise<VendureCustomerProjection> {
    this.assertEnabled();
    if (user.vendureCustomerId) {
      return { id: user.vendureCustomerId };
    }

    const existing = await this.findCustomerByEmail(user.email);
    if (existing) {
      return existing;
    }

    const name = splitDisplayName(user.displayName);
    const created = await this.adminRequest<{
      createCustomer: {
        __typename: string;
        id?: string;
        message?: string;
      };
    }>(
      `
        mutation CreateCustomer($input: CreateCustomerInput!) {
          createCustomer(input: $input) {
            __typename
            ... on Customer {
              id
            }
            ... on ErrorResult {
              message
            }
          }
        }
      `,
      {
        input: {
          firstName: name.firstName,
          lastName: name.lastName,
          emailAddress: user.email
        }
      }
    );

    const result = created.createCustomer;
    if (result.__typename !== 'Customer' || !result.id) {
      throw new BadGatewayException(result.message || 'Vendure 客户创建失败');
    }

    return { id: result.id };
  }

  async setProductAvailability(productId: string, variantId: string, enabled: boolean) {
    this.assertEnabled();

    await this.adminRequest<{
      updateProduct: {
        id: string;
      };
    }>(
      `
        mutation UpdateProduct($input: UpdateProductInput!) {
          updateProduct(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          id: productId,
          enabled
        }
      }
    );

    await this.adminRequest<{
      updateProductVariant: {
        id: string;
      };
    }>(
      `
        mutation UpdateProductVariant($input: UpdateProductVariantInput!) {
          updateProductVariant(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          id: variantId,
          enabled
        }
      }
    );
  }

  async createPlacedOrder(params: {
    customerId: string;
    productVariantId: string;
    note?: string | null;
  }): Promise<VendureOrderProjection> {
    this.assertEnabled();
    const draft = await this.adminRequest<{ createDraftOrder: { id: string } }>(
      `
        mutation CreateDraftOrder {
          createDraftOrder {
            id
          }
        }
      `
    );

    const orderId = draft.createDraftOrder.id;
    await this.expectOrderResult(
      this.adminRequest<{ setCustomerForDraftOrder: VendureOrderResult }>(
        `
          mutation SetCustomerForDraftOrder($orderId: ID!, $customerId: ID!) {
            setCustomerForDraftOrder(orderId: $orderId, customerId: $customerId) {
              __typename
              ... on Order {
                id
                code
                state
              }
              ... on ErrorResult {
                errorCode
                message
              }
            }
          }
        `,
        {
          orderId,
          customerId: params.customerId
        }
      ),
      'setCustomerForDraftOrder'
    );

    await this.expectOrderResult(
      this.adminRequest<{ addItemToDraftOrder: VendureOrderResult }>(
        `
          mutation AddItemToDraftOrder($orderId: ID!, $input: AddItemToDraftOrderInput!) {
            addItemToDraftOrder(orderId: $orderId, input: $input) {
              __typename
              ... on Order {
                id
                code
                state
              }
              ... on ErrorResult {
                errorCode
                message
              }
            }
          }
        `,
        {
          orderId,
          input: {
            productVariantId: params.productVariantId,
            quantity: 1
          }
        }
      ),
      'addItemToDraftOrder'
    );

    if (params.note?.trim()) {
      await this.adminRequest<{ addNoteToOrder: { id: string } }>(
        `
          mutation AddNoteToOrder($input: AddNoteToOrderInput!) {
            addNoteToOrder(input: $input) {
              id
            }
          }
        `,
        {
          input: {
            id: orderId,
            note: params.note.trim(),
            isPublic: true
          }
        }
      );
    }

    const placed = await this.expectOrderResult(
      this.adminRequest<{ transitionOrderToState: VendureOrderResult | null }>(
        `
          mutation TransitionOrderToState($id: ID!, $state: String!) {
            transitionOrderToState(id: $id, state: $state) {
              __typename
              ... on Order {
                id
                code
                state
              }
              ... on ErrorResult {
                errorCode
                message
              }
            }
          }
        `,
        {
          id: orderId,
          state: 'ArrangingPayment'
        }
      ),
      'transitionOrderToState'
    );

    return {
      id: placed.id,
      code: placed.code,
      state: placed.state
    };
  }

  async getOrder(id: string): Promise<VendureOrderProjection> {
    this.assertEnabled();
    const data = await this.adminRequest<{
      order: {
        id: string;
        code: string;
        state: string;
      } | null;
    }>(
      `
        query GetOrder($id: ID!) {
          order(id: $id) {
            id
            code
            state
          }
        }
      `,
      { id }
    );

    if (!data.order) {
      throw new BadGatewayException('Vendure 订单不存在');
    }

    return {
      id: data.order.id,
      code: data.order.code,
      state: data.order.state
    };
  }

  async cancelOrder(orderId: string, reason?: string | null): Promise<VendureOrderProjection> {
    this.assertEnabled();
    const result = await this.expectOrderResult(
      this.adminRequest<{ cancelOrder: VendureOrderResult | null }>(
        `
          mutation CancelOrder($input: CancelOrderInput!) {
            cancelOrder(input: $input) {
              __typename
              ... on Order {
                id
                code
                state
              }
              ... on ErrorResult {
                errorCode
                message
              }
            }
          }
        `,
        {
          input: {
            orderId,
            reason: reason?.trim() || undefined
          }
        }
      ),
      'cancelOrder'
    );

    return result;
  }

  async settleOrderPayment(orderId: string): Promise<VendureOrderProjection> {
    this.assertEnabled();
    const order = await this.getOrder(orderId);
    if (order.state === 'PaymentSettled') {
      return {
        id: order.id,
        code: order.code,
        state: order.state
      };
    }

    const paymentMethodCode = await this.ensureOfflinePaymentMethodCode();
    return this.expectOrderResult(
      this.adminRequest<{ addManualPaymentToOrder: VendureOrderResult | null }>(
        `
          mutation AddManualPaymentToOrder($input: ManualPaymentInput!) {
            addManualPaymentToOrder(input: $input) {
              __typename
              ... on Order {
                id
                code
                state
              }
              ... on ErrorResult {
                errorCode
                message
              }
            }
          }
        `,
        {
          input: {
            orderId,
            method: paymentMethodCode,
            metadata: {
              source: 'swapcampus-offline-meetup'
            }
          }
        }
      ),
      'addManualPaymentToOrder'
    );
  }

  async adminRequest<T>(query: string, variables?: Record<string, unknown>, retry = true): Promise<T> {
    this.assertEnabled();
    const token = await this.getAdminToken();
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ query, variables })
    });

    if (response.status === 401 && retry) {
      this.authToken = null;
      return this.adminRequest<T>(query, variables, false);
    }

    if (!response.ok) {
      throw new BadGatewayException(`Vendure 请求失败：${response.status}`);
    }

    const payload = (await response.json()) as VendureGraphqlResponse<T>;
    if (payload.errors?.length) {
      throw new BadGatewayException(payload.errors.map((error) => error.message).join('; '));
    }
    if (!payload.data) {
      throw new BadGatewayException('Vendure 返回空数据');
    }
    return payload.data;
  }

  private async getAdminToken() {
    if (this.authToken) {
      return this.authToken;
    }

    if (!this.authPromise) {
      this.authPromise = this.loginAdmin().finally(() => {
        this.authPromise = null;
      });
    }

    this.authToken = await this.authPromise;
    return this.authToken;
  }

  private async loginAdmin() {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
              __typename
              ... on CurrentUser {
                id
                identifier
              }
              ... on ErrorResult {
                message
              }
            }
          }
        `,
        variables: {
          username: process.env.VENDURE_ADMIN_USERNAME || 'superadmin',
          password: process.env.VENDURE_ADMIN_PASSWORD || 'superadmin'
        }
      })
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`Vendure 登录失败：${response.status}`);
    }

    const token = response.headers.get('vendure-auth-token');
    if (!token) {
      throw new ServiceUnavailableException('Vendure 未返回管理令牌');
    }

    return token;
  }

  private async ensureOfflinePaymentMethodCode() {
    if (!this.paymentMethodCodePromise) {
      this.paymentMethodCodePromise = this.resolveOfflinePaymentMethodCode().finally(() => {
        this.paymentMethodCodePromise = null;
      });
    }

    return this.paymentMethodCodePromise;
  }

  private async resolveOfflinePaymentMethodCode() {
    const existing = await this.findOfflinePaymentMethodCode();
    if (existing) {
      return existing;
    }

    const created = await this.adminRequest<{
      createPaymentMethod: {
        code: string;
      };
    }>(
      `
        mutation CreatePaymentMethod($input: CreatePaymentMethodInput!) {
          createPaymentMethod(input: $input) {
            code
          }
        }
      `,
      {
        input: {
          code: DEFAULT_PAYMENT_METHOD_CODE,
          enabled: true,
          handler: {
            code: 'dummy-payment-handler',
            arguments: [
              {
                name: 'automaticSettle',
                value: 'true'
              }
            ]
          },
          translations: [
            {
              languageCode: DEFAULT_LANGUAGE_CODE,
              name: '线下面交收款',
              description: '用于校园面交成交后的人工收款确认'
            }
          ]
        }
      }
    );

    return created.createPaymentMethod.code;
  }

  private async findOfflinePaymentMethodCode(): Promise<string | null> {
    const data = await this.adminRequest<{
      paymentMethods: {
        items: Array<{
          code: string;
        }>;
      };
    }>(
      `
        query PaymentMethods($options: PaymentMethodListOptions) {
          paymentMethods(options: $options) {
            items {
              code
            }
          }
        }
      `,
      {
        options: {
          take: 100
        }
      }
    );

    const item = data.paymentMethods.items.find((entry) => entry.code === DEFAULT_PAYMENT_METHOD_CODE);
    return item?.code ?? null;
  }

  private async findVariantBySku(sku: string): Promise<VendureProductProjection | null> {
    const data = await this.adminRequest<{
      productVariants: {
        items: Array<{
          id: string;
          productId: string;
        }>;
      };
    }>(
      `
        query ProductVariants($options: ProductVariantListOptions) {
          productVariants(options: $options) {
            items {
              id
              productId
            }
          }
        }
      `,
      {
        options: {
          filter: {
            sku: {
              eq: sku
            }
          },
          take: 1
        }
      }
    );

    const item = data.productVariants.items[0];
    return item ? { id: item.productId, variantId: item.id } : null;
  }

  private async findCustomerByEmail(email: string): Promise<VendureCustomerProjection | null> {
    const data = await this.adminRequest<{
      customers: {
        items: Array<{ id: string }>;
      };
    }>(
      `
        query Customers($options: CustomerListOptions) {
          customers(options: $options) {
            items {
              id
            }
          }
        }
      `,
      {
        options: {
          filter: {
            emailAddress: {
              eq: email
            }
          },
          take: 1
        }
      }
    );

    const item = data.customers.items[0];
    return item ? { id: item.id } : null;
  }

  private async expectOrderResult<T extends Record<string, VendureOrderResult | null>>(
    promise: Promise<T>,
    key: keyof T
  ) {
    const data = await promise;
    const result = data[key];
    if (!result || result.__typename !== 'Order' || !result.id || !result.code || !result.state) {
      throw new BadGatewayException(result?.message || 'Vendure 订单操作失败');
    }
    return {
      id: result.id,
      code: result.code,
      state: result.state
    };
  }

  private buildSku(productId: number) {
    return `swapcampus-product-${productId}`;
  }

  private toVendureMoney(value: unknown) {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return 0;
    }
    return Math.round(numeric * 100);
  }

  private assertEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Vendure 订单系统未启用');
    }
  }
}
