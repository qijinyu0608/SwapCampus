import type { CampusServiceCategory } from '../services/api';

export const CAMPUS_SERVICE_CATEGORY_OPTIONS: Array<{
  key: CampusServiceCategory;
  title: string;
}> = [
  { key: 'ERRAND', title: '校园跑腿' },
  { key: 'AGENCY', title: '代办代取' },
  { key: 'GROUP_BUY', title: '校内拼单' },
  { key: 'MOVING', title: '搬运协助' },
  { key: 'TUTORING', title: '学习辅导' },
  { key: 'SKILL', title: '技能支持' },
  { key: 'REPAIR', title: '维修安装' },
  { key: 'EVENT', title: '活动协助' },
  { key: 'OTHER', title: '其他服务' },
  { key: 'HELP', title: '临时帮忙（旧版）' }
] as const;

export const CAMPUS_SERVICE_CATEGORY_LABEL: Record<CampusServiceCategory, string> = {
  ERRAND: '跑腿',
  AGENCY: '代办',
  GROUP_BUY: '拼单',
  MOVING: '搬运',
  TUTORING: '辅导',
  SKILL: '技能',
  REPAIR: '维修',
  EVENT: '活动协助',
  OTHER: '其他',
  HELP: '临时帮忙'
};
