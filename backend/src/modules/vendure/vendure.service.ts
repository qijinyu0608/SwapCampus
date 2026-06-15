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

type VendurePaymentProjection = {
  id: string;
  state: string;
};

type VendureFulfillmentProjection = {
  id: string;
  state: string;
  nextStates: string[];
};

type VendureOrderLineProjection = {
  id: string;
  quantity: number;
  fulfillmentLines: Array<{
    fulfillmentId: string;
    quantity: number;
  }>;
};

type VendureOrderDetailProjection = VendureOrderProjection & {
  payments: VendurePaymentProjection[];
  fulfillments: VendureFulfillmentProjection[];
  lines: VendureOrderLineProjection[];
};

type VendureOrderResult = {
  __typename?: string;
  id?: string;
  code?: string;
  state?: string;
  message?: string;
  errorCode?: string;
};

type VendureFulfillmentResult = {
  __typename?: string;
  id?: string;
  state?: string;
  nextStates?: string[];
  message?: string;
  errorCode?: string;
};

type VendureFulfillmentHandlerDefinition = {
  code: string;
  args: Array<{
    name: string;
    required: boolean;
    defaultValue?: unknown;
  }>;
};

const DEFAULT_LANGUAGE_CODE = 'zh_Hans';
const DEFAULT_PAYMENT_METHOD_CODE = 'swapcampus-offline-payment';
const DEFAULT_FULFILLMENT_HANDLER_CODE = 'manual-fulfillment';
const KNOWN_PAID_ORDER_STATES = new Set([
  'PaymentSettled',
  'PartiallyShipped',
  'Shipped',
  'PartiallyDelivered',
  'Delivered'
]);
const KNOWN_PAYABLE_ORDER_STATES = new Set(['ArrangingPayment', 'ArrangingAdditionalPayment']);
const MAX_FULFILLMENT_STATE_TRANSITIONS = 5;

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
  private fulfillmentHandlerPromise: Promise<{
    code: string;
    arguments: Array<{ name: string; value: string }>;
  }> | null = null;

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
            trackInventory: 'TRUE',
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

  async setProductInventory(_productId: string, variantId: string, stockOnHand: number) {
    this.assertEnabled();

    await this.adminRequest<{
      updateProductVariant: {
        id: string;
      };
    }>(
      `
        mutation UpdateProductVariantInventory($input: UpdateProductVariantInput!) {
          updateProductVariant(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          id: variantId,
          stockOnHand: Math.max(0, Math.floor(stockOnHand)),
          trackInventory: 'TRUE'
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

  async getOrderDetail(id: string): Promise<VendureOrderDetailProjection> {
    this.assertEnabled();
    const data = await this.adminRequest<{
      order: {
        id: string;
        code: string;
        state: string;
        payments: Array<{
          id: string;
          state: string;
        }>;
        fulfillments: Array<{
          id: string;
          state: string;
          nextStates?: string[] | null;
        }>;
        lines: Array<{
          id: string;
          quantity: number;
          fulfillmentLines: Array<{
            fulfillmentId: string;
            quantity: number;
          }>;
        }>;
      } | null;
    }>(
      `
        query GetOrderDetail($id: ID!) {
          order(id: $id) {
            id
            code
            state
            payments {
              id
              state
            }
            fulfillments {
              id
              state
              nextStates
            }
            lines {
              id
              quantity
              fulfillmentLines {
                fulfillmentId
                quantity
              }
            }
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
      state: data.order.state,
      payments: data.order.payments ?? [],
      fulfillments: (data.order.fulfillments ?? []).map((item) => ({
        id: item.id,
        state: item.state,
        nextStates: item.nextStates ?? []
      })),
      lines: (data.order.lines ?? []).map((line) => ({
        id: line.id,
        quantity: line.quantity,
        fulfillmentLines: line.fulfillmentLines ?? []
      }))
    };
  }

  async cancelOrder(orderId: string, reason?: string | null): Promise<VendureOrderProjection> {
    this.assertEnabled();
    const current = await this.getOrder(orderId);
    if (current.state === 'Cancelled') {
      return current;
    }

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
    const order = await this.getOrderDetail(orderId);
    if (this.isOrderPaid(order)) {
      return {
        id: order.id,
        code: order.code,
        state: order.state
      };
    }

    if (!KNOWN_PAYABLE_ORDER_STATES.has(order.state)) {
      throw new BadGatewayException(`Vendure 订单当前状态 ${order.state} 无法执行收款确认`);
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

  async completeOrderFulfillment(orderId: string): Promise<VendureOrderProjection> {
    this.assertEnabled();
    const order = await this.getOrderDetail(orderId);
    if (order.state === 'Delivered') {
      return {
        id: order.id,
        code: order.code,
        state: order.state
      };
    }

    let fulfillment = order.fulfillments[0] ?? null;
    if (!fulfillment) {
      fulfillment = await this.createFulfillmentForOrder(order);
    }

    if (fulfillment) {
      await this.transitionFulfillmentToDelivered(fulfillment);
    }

    return this.getOrder(orderId);
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

  private async ensureFulfillmentHandlerConfig() {
    if (!this.fulfillmentHandlerPromise) {
      this.fulfillmentHandlerPromise = this.resolveFulfillmentHandlerConfig().finally(() => {
        this.fulfillmentHandlerPromise = null;
      });
    }

    return this.fulfillmentHandlerPromise;
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

  private async resolveFulfillmentHandlerConfig() {
    const data = await this.adminRequest<{
      fulfillmentHandlers: VendureFulfillmentHandlerDefinition[];
    }>(
      `
        query GetFulfillmentHandlers {
          fulfillmentHandlers {
            code
            args {
              name
              required
              defaultValue
            }
          }
        }
      `
    );

    const handlers = data.fulfillmentHandlers ?? [];
    const preferredCode = process.env.VENDURE_FULFILLMENT_HANDLER_CODE?.trim() || DEFAULT_FULFILLMENT_HANDLER_CODE;
    const preferred = handlers.find((handler) => handler.code === preferredCode);
    const fallback = handlers.find((handler) => this.canUseHandlerWithoutOverrides(handler));
    const selected = preferred ?? fallback;

    if (!selected) {
      throw new BadGatewayException('Vendure 未找到可用的履约处理器');
    }

    if (!this.canUseHandlerWithoutOverrides(selected)) {
      throw new BadGatewayException(`Vendure 履约处理器 ${selected.code} 仍需额外参数，无法自动调用`);
    }

    return {
      code: selected.code,
      arguments: selected.args
        .filter((arg) => arg.defaultValue !== undefined && arg.defaultValue !== null)
        .map((arg) => ({
          name: arg.name,
          value: JSON.stringify(arg.defaultValue)
        }))
    };
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

  private async createFulfillmentForOrder(order: VendureOrderDetailProjection) {
    const lines = order.lines
      .map((line) => {
        const fulfilledQuantity = line.fulfillmentLines.reduce((sum, item) => sum + item.quantity, 0);
        const remainingQuantity = Math.max(0, line.quantity - fulfilledQuantity);
        return remainingQuantity > 0
          ? {
              orderLineId: line.id,
              quantity: remainingQuantity
            }
          : null;
      })
      .filter((item): item is { orderLineId: string; quantity: number } => Boolean(item));

    if (!lines.length) {
      return order.fulfillments[0] ?? null;
    }

    const handler = await this.ensureFulfillmentHandlerConfig();
    return this.expectFulfillmentResult(
      this.adminRequest<{ addFulfillmentToOrder: VendureFulfillmentResult | null }>(
        `
          mutation AddFulfillmentToOrder($input: FulfillOrderInput!) {
            addFulfillmentToOrder(input: $input) {
              __typename
              ... on Fulfillment {
                id
                state
                nextStates
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
            handler,
            lines
          }
        }
      ),
      'addFulfillmentToOrder'
    );
  }

  private async transitionFulfillmentToDelivered(fulfillment: VendureFulfillmentProjection) {
    let current = fulfillment;

    for (let index = 0; index < MAX_FULFILLMENT_STATE_TRANSITIONS && current.state !== 'Delivered'; index += 1) {
      const nextState = current.nextStates.includes('Delivered')
        ? 'Delivered'
        : current.nextStates.includes('Shipped')
          ? 'Shipped'
          : null;

      if (!nextState) {
        throw new BadGatewayException(`Vendure 履约状态 ${current.state} 无法推进到 Delivered`);
      }

      current = await this.expectFulfillmentResult(
        this.adminRequest<{ transitionFulfillmentToState: VendureFulfillmentResult | null }>(
          `
            mutation TransitionFulfillmentToState($id: ID!, $state: String!) {
              transitionFulfillmentToState(id: $id, state: $state) {
                __typename
                ... on Fulfillment {
                  id
                  state
                  nextStates
                }
                ... on ErrorResult {
                  errorCode
                  message
                }
              }
            }
          `,
          {
            id: current.id,
            state: nextState
          }
        ),
        'transitionFulfillmentToState'
      );
    }

    if (current.state !== 'Delivered') {
      throw new BadGatewayException('Vendure 履约状态推进未到达 Delivered');
    }

    return current;
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

  private async expectFulfillmentResult<T extends Record<string, VendureFulfillmentResult | null>>(
    promise: Promise<T>,
    key: keyof T
  ) {
    const data = await promise;
    const result = data[key];
    if (!result || result.__typename !== 'Fulfillment' || !result.id || !result.state) {
      throw new BadGatewayException(result?.message || 'Vendure 履约操作失败');
    }
    return {
      id: result.id,
      state: result.state,
      nextStates: result.nextStates ?? []
    };
  }

  private isOrderPaid(order: VendureOrderProjection | VendureOrderDetailProjection) {
    if (KNOWN_PAID_ORDER_STATES.has(order.state)) {
      return true;
    }

    return 'payments' in order
      ? order.payments.some((payment) => payment.state === 'Settled')
      : false;
  }

  private canUseHandlerWithoutOverrides(handler: VendureFulfillmentHandlerDefinition) {
    return handler.args.every((arg) => !arg.required || arg.defaultValue !== undefined);
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
      throw new ServiceUnavailableException('Vendure 同步当前已禁用');
    }
  }
}
