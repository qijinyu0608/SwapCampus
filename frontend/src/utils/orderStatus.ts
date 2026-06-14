import type { CampusServiceOrderDetail } from '../services/api';

export function formatProductOrderStatus(status: string) {
  if (status === 'PENDING') {
    return '待协商';
  }
  if (status === 'IN_PROGRESS') {
    return '待收货';
  }
  if (status === 'WAITING_REVIEW') {
    return '待评价';
  }
  if (status === 'COMPLETED') {
    return '已完成';
  }
  if (status === 'CANCELED') {
    return '已取消';
  }
  return status;
}

export function getProductOrderStatusColor(status: string) {
  if (status === 'COMPLETED') {
    return 'green';
  }
  if (status === 'WAITING_REVIEW') {
    return 'gold';
  }
  if (status === 'CANCELED') {
    return 'default';
  }
  return 'orange';
}

export function getCampusServiceOrderStatusColor(status: CampusServiceOrderDetail['orderStatus']) {
  if (status === 'COMPLETED') {
    return 'green';
  }
  if (status === 'WAITING_COMPLETE_CONFIRM') {
    return 'gold';
  }
  if (status === 'REJECTED' || status === 'CANCELED' || status === 'EXPIRED') {
    return 'default';
  }
  if (status === 'CONFIRMED') {
    return 'blue';
  }
  return 'orange';
}
