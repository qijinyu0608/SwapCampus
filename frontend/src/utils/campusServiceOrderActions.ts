import { getApiErrorMessage, type CampusServiceOrderListItem } from '../services/api';

type CampusServiceOrderActionOptions = {
  run: () => Promise<unknown>;
  onSuccess?: () => void | Promise<void>;
  onFinally?: () => void;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  successMessage: string;
  fallbackErrorMessage: string;
};

export async function executeCampusServiceOrderAction(options: CampusServiceOrderActionOptions) {
  try {
    await options.run();
    await options.onSuccess?.();
    options.notifySuccess(options.successMessage);
  } catch (error) {
    options.notifyError(getApiErrorMessage(error, options.fallbackErrorMessage));
  } finally {
    options.onFinally?.();
  }
}

export function getCampusServiceOrderRequestLabel(order: Pick<CampusServiceOrderListItem, 'intent'>) {
  return order.intent === 'REQUEST' ? '接单申请' : '预约申请';
}

export function getCampusServiceOrderRejectOrCancelText(
  order: Pick<CampusServiceOrderListItem, 'actionState' | 'actionLabels'>
) {
  const isReject = order.actionState.canReject;
  return {
    title: isReject ? (order.actionLabels.reject ?? '拒绝申请') : (order.actionLabels.cancel ?? '取消当前协作'),
    confirmText: isReject ? (order.actionLabels.reject ?? '确认拒绝') : (order.actionLabels.cancel ?? '确认取消')
  };
}
