#!/usr/bin/env node

import { getCampusServiceLocalImage } from './campus-service-local-images.mjs';

const API_BASE_URL = process.env.SWAPCAMPUS_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
const LOGIN_ACCOUNT = process.env.SWAPCAMPUS_TEST_ACCOUNT ?? 'user';
const LOGIN_PASSWORD = process.env.SWAPCAMPUS_TEST_PASSWORD ?? 'user';
function sanitizePublishTitle(rawTitle) {
  return rawTitle
    .replace(/^HTTP 集成主账号拼单/, '校内午餐拼单')
    .replace(/^HTTP 集成/, '')
    .trim();
}

const CAMPUS_SERVICE_TEST_ACCOUNTS = [
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_0 ?? 'user',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_0 ?? 'user',
    intent: 'REQUEST',
    category: 'GROUP_BUY',
    title: `HTTP 集成主账号拼单 ${Date.now()}`,
    description: '中午一起拼一份轻食外卖，按人数平摊后统一下单。',
    priceMode: 'FIXED',
    amount: 1,
    locationNote: '群里确认后统一下单'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_1 ?? 'user01@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_1 ?? 'user01',
    intent: 'REQUEST',
    category: 'ERRAND',
    title: `HTTP 集成快递代取 ${Date.now()}`,
    description: '午间可帮忙代取东门快递。',
    priceMode: 'FIXED',
    amount: 6,
    locationNote: '东门快递柜'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_2 ?? 'user02@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_2 ?? 'user02',
    intent: 'REQUEST',
    category: 'MOVING',
    title: `HTTP 集成宿舍搬运 ${Date.now()}`,
    description: '今晚可帮忙搬一箱资料到隔壁楼。 ',
    priceMode: 'FIXED',
    amount: 12,
    locationNote: '一号楼到七号楼'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_4 ?? 'user08@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_4 ?? 'user08',
    intent: 'OFFER',
    category: 'HELP',
    title: `HTTP 集成临时帮忙 ${Date.now()}`,
    description: '晚间可顺路帮忙带饭或送资料。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '宿舍区私聊'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_5 ?? 'user03@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_5 ?? 'user03',
    intent: 'OFFER',
    category: 'TUTORING',
    title: `HTTP 集成高数辅导 ${Date.now()}`,
    description: '本周可线上辅导高数基础题型。',
    priceMode: 'FIXED',
    amount: 35,
    locationNote: '腾讯会议 / 站内消息约时间'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_6 ?? 'user04@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_6 ?? 'user04',
    intent: 'REQUEST',
    category: 'REPAIR',
    title: `HTTP 集成宿舍小修 ${Date.now()}`,
    description: '书桌灯安装需要一个十字螺丝刀。',
    priceMode: 'FIXED',
    amount: 18,
    locationNote: '8号宿舍楼一层'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_7 ?? 'user05@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_7 ?? 'user05',
    intent: 'OFFER',
    category: 'EVENT',
    title: `HTTP 集成活动搭子 ${Date.now()}`,
    description: '周末可一起跑步打卡或自习组队。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '操场 / 图书馆'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_7A ?? 'admin@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_7A ?? 'admin',
    intent: 'OFFER',
    category: 'EVENT',
    title: `HTTP 集成管理员活动引导 ${Date.now()}`,
    description: '可帮忙整理活动签到动线与现场指引说明。',
    priceMode: 'FIXED',
    amount: 9,
    locationNote: '线上沟通后交付'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_8 ?? 'user06@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_8 ?? 'user06',
    intent: 'REQUEST',
    category: 'AGENCY',
    title: `HTTP 集成材料代交 ${Date.now()}`,
    description: '明早需要帮忙把校园卡补办材料交到学生服务中心窗口，材料都已整理好。',
    priceMode: 'FIXED',
    amount: 10,
    locationNote: '学生服务中心'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_9 ?? 'user07@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_9 ?? 'user07',
    intent: 'OFFER',
    category: 'SKILL',
    title: `HTTP 集成设计排版 ${Date.now()}`,
    description: '今晚可帮忙做简历排版、基础海报设计和简单图片处理。',
    priceMode: 'FIXED',
    amount: 25,
    locationNote: '线上沟通'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_10 ?? 'user09@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_10 ?? 'user09',
    intent: 'REQUEST',
    category: 'GROUP_BUY',
    title: `HTTP 集成法学院拼单 ${Date.now()}`,
    description: '晚间一起拼打印和资料装订，下单后按人数平摊费用。',
    priceMode: 'FIXED',
    amount: 2,
    locationNote: '群里确认打印份数后统一下单'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_11 ?? 'user10@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_11 ?? 'user10',
    intent: 'REQUEST',
    category: 'ERRAND',
    title: `HTTP 集成园艺学院资料转交 ${Date.now()}`,
    description: '下午需要帮忙把社团资料从教学楼顺路转交到学院办公室。',
    priceMode: 'FIXED',
    amount: 7,
    locationNote: '教学楼 A 区到园艺园林学院办公室'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_12 ?? 'user11@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_12 ?? 'user11',
    intent: 'OFFER',
    category: 'SKILL',
    title: `HTTP 集成药学院表格整理 ${Date.now()}`,
    description: '今晚可帮忙整理社团签到表、活动报名表和公开展示用信息排版。',
    priceMode: 'FIXED',
    amount: 16,
    locationNote: '线上沟通后交付'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_13 ?? 'user12@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_13 ?? 'user12',
    intent: 'OFFER',
    category: 'HELP',
    title: `HTTP 集成动物科技学院顺路帮忙 ${Date.now()}`,
    description: '今晚回宿舍途中可顺路帮忙带饭、送打印材料或把小件物品放到宿舍楼下。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '宿舍区内顺路帮忙'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_14 ?? 'user13@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_14 ?? 'user13',
    intent: 'OFFER',
    category: 'EVENT',
    title: `HTTP 集成资源学院活动搭子 ${Date.now()}`,
    description: '周末可一起跑步打卡或自习组队。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '资源与环境学院 / 图书馆'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_15 ?? 'user14@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_15 ?? 'user14',
    intent: 'OFFER',
    category: 'TUTORING',
    title: `HTTP 集成食品学院高数辅导 ${Date.now()}`,
    description: '本周可线上辅导高数基础题型。',
    priceMode: 'FIXED',
    amount: 35,
    locationNote: '线上语音或站内消息约时间'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_16 ?? 'user15@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_16 ?? 'user15',
    intent: 'REQUEST',
    category: 'REPAIR',
    title: `HTTP 集成机电学院宿舍小修 ${Date.now()}`,
    description: '书桌灯安装需要一个十字螺丝刀。',
    priceMode: 'FIXED',
    amount: 18,
    locationNote: '机电工程学院宿舍区'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_17 ?? 'user16@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_17 ?? 'user16',
    intent: 'OFFER',
    category: 'HELP',
    title: `HTTP 集成植保学院顺路帮忙 ${Date.now()}`,
    description: '晚间回宿舍途中可顺路帮忙带饭、送资料或把小件物品放到楼下。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '植保学院宿舍区内顺路帮忙'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_18 ?? 'user17@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_18 ?? 'user17',
    intent: 'OFFER',
    category: 'EVENT',
    title: `HTTP 集成水利学院活动搭子 ${Date.now()}`,
    description: '周末可一起跑步打卡或自习组队。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '水利与土木工程学院 / 图书馆'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_19 ?? 'user18@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_19 ?? 'user18',
    intent: 'REQUEST',
    category: 'ERRAND',
    title: `HTTP 集成经管学院快递代取 ${Date.now()}`,
    description: '午间可帮忙代取西门快递后送到学院楼下。',
    priceMode: 'FIXED',
    amount: 6,
    locationNote: '西门快递柜到经济管理学院楼下'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_20 ?? 'user19@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_20 ?? 'user19',
    intent: 'OFFER',
    category: 'SKILL',
    title: `HTTP 集成材料学院海报排版 ${Date.now()}`,
    description: '今晚可帮忙做活动海报排版和基础配图。',
    priceMode: 'FIXED',
    amount: 20,
    locationNote: '线上沟通'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_21 ?? 'user20@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_21 ?? 'user20',
    intent: 'OFFER',
    category: 'EVENT',
    title: `HTTP 集成国际学院周末搭子 ${Date.now()}`,
    description: '周末可一起跑步打卡或自习组队。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '国际学院 / 图书馆'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_22 ?? 'user21@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_22 ?? 'user21',
    intent: 'REQUEST',
    category: 'REPAIR',
    title: `HTTP 集成理学院宿舍检修 ${Date.now()}`,
    description: '书桌灯和插线板需要基础检修。',
    priceMode: 'FIXED',
    amount: 16,
    locationNote: '理学院宿舍区'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_23 ?? 'user22@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_23 ?? 'user22',
    intent: 'REQUEST',
    category: 'AGENCY',
    title: `HTTP 集成草业学院材料代交 ${Date.now()}`,
    description: '需要帮忙把整理好的纸质材料送到学院办公室。',
    priceMode: 'FIXED',
    amount: 8,
    locationNote: '草业与草原学院办公室'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_24 ?? 'user23@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_24 ?? 'user23',
    intent: 'OFFER',
    category: 'HELP',
    title: `HTTP 集成水土保持学院顺路帮忙 ${Date.now()}`,
    description: '晚间回宿舍途中可顺路带饭、送资料或把小件物品放到楼下。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '水土保持学院宿舍区内顺路帮忙'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_25 ?? 'user24@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_25 ?? 'user24',
    intent: 'OFFER',
    category: 'TUTORING',
    title: `HTTP 集成马院公开表达陪练 ${Date.now()}`,
    description: '本周可线上梳理公开分享表达节奏、开场过渡和发言逻辑。',
    priceMode: 'FIXED',
    amount: 28,
    locationNote: '线上语音或站内消息约时间'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_26 ?? 'user25@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_26 ?? 'user25',
    intent: 'REQUEST',
    category: 'ERRAND',
    title: `HTTP 集成环工学院资料代拿 ${Date.now()}`,
    description: '图书馆服务台的资料需要顺路代拿到教学楼。',
    priceMode: 'FIXED',
    amount: 5,
    locationNote: '图书馆服务台到教学楼'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_27 ?? 'user26@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_27 ?? 'user26',
    intent: 'OFFER',
    category: 'SKILL',
    title: `HTTP 集成计控学院 PPT 梳理 ${Date.now()}`,
    description: '今晚可帮忙梳理课程汇报 PPT 结构和视觉层级。',
    priceMode: 'FIXED',
    amount: 26,
    locationNote: '线上沟通'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_28 ?? 'user27@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_28 ?? 'user27',
    intent: 'OFFER',
    category: 'HELP',
    title: `HTTP 集成英语学院早起搭子 ${Date.now()}`,
    description: '考试周可顺路提醒、占座或一起去自习室。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '英语学院宿舍区 / 自习室'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_29 ?? 'user28@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_29 ?? 'user28',
    intent: 'REQUEST',
    category: 'REPAIR',
    title: `HTTP 集成机电学院二号宿舍检修 ${Date.now()}`,
    description: '宿舍台灯和小风扇需要基础检修。',
    priceMode: 'FIXED',
    amount: 18,
    locationNote: '机械与电气工程学院宿舍区'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_30 ?? 'user29@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_30 ?? 'user29',
    intent: 'REQUEST',
    category: 'AGENCY',
    title: `HTTP 集成数统学院材料代交 ${Date.now()}`,
    description: '整理好的表格和纸质材料需要送到学院办公室。',
    priceMode: 'FIXED',
    amount: 9,
    locationNote: '数学与统计学院办公室'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_31 ?? 'user30@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_31 ?? 'user30',
    intent: 'OFFER',
    category: 'EVENT',
    title: `HTTP 集成新能源学院周末搭子 ${Date.now()}`,
    description: '周末可一起跑步打卡或自习组队。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '新能源学院 / 图书馆'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_32 ?? 'user31@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_32 ?? 'user31',
    intent: 'REQUEST',
    category: 'MOVING',
    title: `HTTP 集成化工学院跨楼搬箱 ${Date.now()}`,
    description: '理科楼和实验楼之间需要搬两箱课程资料，适合顺路同学帮忙。',
    priceMode: 'FIXED',
    amount: 14,
    locationNote: '理科楼到实验楼'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_33 ?? 'user32@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_33 ?? 'user32',
    intent: 'OFFER',
    category: 'TUTORING',
    title: `HTTP 集成地科院公开演讲陪练 ${Date.now()}`,
    description: '今晚可线上梳理公开表达节奏、开场过渡和讲解逻辑。',
    priceMode: 'FIXED',
    amount: 28,
    locationNote: '线上语音或站内消息约时间'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_34 ?? 'user33@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_34 ?? 'user33',
    intent: 'REQUEST',
    category: 'GROUP_BUY',
    title: `HTTP 集成金融学院晚间咖啡拼单 ${Date.now()}`,
    description: '晚间自习前想一起拼咖啡，下单后按人数平摊费用。',
    priceMode: 'FIXED',
    amount: 2,
    locationNote: '群里确认门店和口味后统一下单'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_35 ?? 'user34@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_35 ?? 'user34',
    intent: 'OFFER',
    category: 'HELP',
    title: `HTTP 集成旅管学院晨读占座互助 ${Date.now()}`,
    description: '考试周可顺路提醒、占自习室前排座位或一起晨读。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '图书馆 / 教学楼自习室'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_36 ?? 'user35@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_36 ?? 'user35',
    intent: 'OFFER',
    category: 'SKILL',
    title: `HTTP 集成传媒学院图文排版 ${Date.now()}`,
    description: '今晚可帮忙整理活动推文配图、海报文案和展示排版。',
    priceMode: 'FIXED',
    amount: 30,
    locationNote: '线上沟通后交付'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_37 ?? 'user36@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_37 ?? 'user36',
    intent: 'OFFER',
    category: 'EVENT',
    title: `HTTP 集成海洋学院活动搭子 ${Date.now()}`,
    description: '周末可一起跑步打卡、自习或参加学院活动签到。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '海洋学院 / 图书馆'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_38 ?? 'user37@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_38 ?? 'user37',
    intent: 'REQUEST',
    category: 'AGENCY',
    title: `HTTP 集成人文学院展板送签 ${Date.now()}`,
    description: '社团活动展板和登记表需要顺路送到学院办事窗口。',
    priceMode: 'FIXED',
    amount: 9,
    locationNote: '社团办公室到学院窗口'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_39 ?? 'user38@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_39 ?? 'user38',
    intent: 'OFFER',
    category: 'SKILL',
    title: `HTTP 集成继教学院证书扫描排版 ${Date.now()}`,
    description: '今晚可帮忙整理证书扫描件、信息脱敏和打印版排版。',
    priceMode: 'FIXED',
    amount: 18,
    locationNote: '线上沟通后交付'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_40 ?? 'user39@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_40 ?? 'user39',
    intent: 'OFFER',
    category: 'EVENT',
    title: `HTTP 集成生态学院林间夜跑搭子 ${Date.now()}`,
    description: '晚饭后可一起夜跑打卡，也能顺路互相提醒。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '操场 / 林荫道'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_41 ?? 'user40@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_41 ?? 'user40',
    intent: 'REQUEST',
    category: 'REPAIR',
    title: `HTTP 集成材科院宿舍小修补灯 ${Date.now()}`,
    description: '宿舍小夜灯和插排接触不稳，想找同学帮忙基础检修。',
    priceMode: 'FIXED',
    amount: 11,
    locationNote: '材料学院宿舍区'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_42 ?? 'user41@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_42 ?? 'user41',
    intent: 'OFFER',
    category: 'HELP',
    title: `HTTP 集成继教学院晨读占位互助 ${Date.now()}`,
    description: '早上可顺路提醒、占位或一起去教学楼晨读。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '教学楼 / 自习室'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_43 ?? 'user42@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_43 ?? 'user42',
    intent: 'REQUEST',
    category: 'GROUP_BUY',
    title: `HTTP 集成国际学院夜宵拼单 ${Date.now()}`,
    description: '晚间自习后想一起拼夜宵，下单后按人数平摊。',
    priceMode: 'FIXED',
    amount: 2,
    locationNote: '群里确认品类后统一下单'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_44 ?? 'user43@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_44 ?? 'user43',
    intent: 'REQUEST',
    category: 'ERRAND',
    title: `HTTP 集成环工学院实验耗材代拿 ${Date.now()}`,
    description: '实验课前需要把已预约的小件耗材从材料点带到实验楼。',
    priceMode: 'FIXED',
    amount: 6,
    locationNote: '实验耗材领取点到实验楼大厅'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_45 ?? 'user44@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_45 ?? 'user44',
    intent: 'OFFER',
    category: 'SKILL',
    title: `HTTP 集成设艺学院作品集封面微调 ${Date.now()}`,
    description: '今晚可帮忙做作品集封面、目录页和统一字体层级微调。',
    priceMode: 'FIXED',
    amount: 22,
    locationNote: '线上沟通后交付'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_46 ?? 'user45@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_46 ?? 'user45',
    intent: 'OFFER',
    category: 'EVENT',
    title: `HTTP 集成马院清晨操场晨跑搭子 ${Date.now()}`,
    description: '早上可一起晨跑打卡，互相提醒出门和记录配速。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '操场 / 林荫路'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_47 ?? 'user46@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_47 ?? 'user46',
    intent: 'REQUEST',
    category: 'AGENCY',
    title: `HTTP 集成草业学院温室样本送签 ${Date.now()}`,
    description: '温室观察记录表和样本登记单需要顺路送到学院老师办公室。',
    priceMode: 'FIXED',
    amount: 10,
    locationNote: '温室实验区到学院办公室'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_48 ?? 'user47@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_48 ?? 'user47',
    intent: 'OFFER',
    category: 'HELP',
    title: `HTTP 集成林学院清晨自习室占位互助 ${Date.now()}`,
    description: '早上可顺路提醒、占位或一起去教学楼晨读。',
    priceMode: 'FREE',
    amount: 0,
    locationNote: '教学楼 / 自习室'
  },
  {
    account: process.env.SWAPCAMPUS_SERVICE_TEST_ACCOUNT_49 ?? 'user48@swapcampus.local',
    password: process.env.SWAPCAMPUS_SERVICE_TEST_PASSWORD_49 ?? 'user48',
    intent: 'OFFER',
    category: 'TUTORING',
    title: `HTTP 集成外语学院演讲稿润色陪练 ${Date.now()}`,
    description: '今晚可线上梳理英语演讲稿表达节奏、停顿和开场衔接。',
    priceMode: 'FIXED',
    amount: 24,
    locationNote: '线上语音或站内消息约时间'
  }
].map((seed) => ({
  ...seed,
  title: sanitizePublishTitle(seed.title)
}));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(path, options = {}) {
  const { method = 'GET', headers = {}, body } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body
  });

  const raw = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  const payload = raw && contentType.includes('application/json') ? JSON.parse(raw) : raw;

  if (!response.ok) {
    const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
    throw new Error(`${method} ${path} failed: ${response.status} ${detail}`);
  }

  return payload;
}

async function loginAccount(account, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account,
      password
    })
  });

  const raw = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  const payload = raw && contentType.includes('application/json') ? JSON.parse(raw) : raw;

  if (!response.ok) {
    const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
    throw new Error(`POST /auth/login failed: ${response.status} ${detail}`);
  }

  assert(payload?.user?.id, `login user.id missing for ${account}`);
  const accessToken = response.headers.get('st-access-token');
  const refreshToken = response.headers.get('st-refresh-token');
  const frontToken = response.headers.get('front-token');
  const setCookie = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie().join('; ')
    : (response.headers.get('set-cookie') ?? '');
  const authHeaders = payload?.devAuthToken
    ? { 'x-dev-auth-user-id': String(payload.devAuthToken) }
    : accessToken
      ? {
          authorization: `Bearer ${accessToken}`,
          ...(refreshToken ? { 'st-refresh-token': refreshToken } : {}),
          ...(frontToken ? { 'front-token': frontToken } : {}),
          'st-auth-mode': 'header'
        }
    : setCookie
      ? { cookie: setCookie }
      : null;

  assert(authHeaders, `login auth headers missing for ${account}`);

  return {
    ...payload,
    authHeaders
  };
}

async function runCase(name, execute) {
  const startedAt = Date.now();
  try {
    const detail = await execute();
    return {
      name,
      status: 'passed',
      durationMs: Date.now() - startedAt,
      detail
    };
  } catch (error) {
    return {
      name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main() {
  const results = [];

  const health = await runCase('health', async () => {
    const payload = await requestJson('/health');
    assert(payload.status === 'ok', 'health status is not ok');
    return payload;
  });
  results.push(health);

  const login = await runCase('auth.login', async () => {
    const payload = await loginAccount(LOGIN_ACCOUNT, LOGIN_PASSWORD);
    return {
      userId: payload.user.id,
      account: payload.account,
      role: payload.user.role,
      verificationStatus: payload.user.verificationStatus,
      devAuthToken: payload.devAuthToken ?? null,
      authHeaders: payload.authHeaders
    };
  });
  results.push(login);

  const authHeaders = login.status === 'passed' ? { ...login.detail.authHeaders } : {};

  results.push(await runCase('products.home-recommendations', async () => {
    const payload = await requestJson('/products/home-recommendations', {
      headers: authHeaders
    });
    assert(Array.isArray(payload), 'home recommendations is not array');
    return {
      count: payload.length,
      sampleIds: payload.slice(0, 5).map((item) => item.id)
    };
  }));

  results.push(await runCase('products.publishing-rules', async () => {
    const payload = await requestJson('/products/publishing-rules');
    assert(payload && typeof payload === 'object', 'publishing rules payload missing');
    return {
      keys: Object.keys(payload).slice(0, 10)
    };
  }));

  results.push(await runCase('favorites.list', async () => {
    assert(Object.keys(authHeaders).length > 0, 'no auth headers for favorites');
    const payload = await requestJson('/favorites', {
      headers: authHeaders
    });
    assert(Array.isArray(payload.items), 'favorites.items is not array');
    return {
      total: payload.total,
      sampleIds: payload.items.slice(0, 5).map((item) => item.id)
    };
  }));

  results.push(await runCase('orders.list', async () => {
    assert(Object.keys(authHeaders).length > 0, 'no auth headers for orders');
    const payload = await requestJson('/orders?page=1&pageSize=5', {
      headers: authHeaders
    });
    assert(Array.isArray(payload.items), 'orders.items is not array');
    return {
      total: payload.pagination?.total ?? payload.items.length,
      sampleIds: payload.items.slice(0, 5).map((item) => item.id)
    };
  }));

  results.push(await runCase('users.history', async () => {
    assert(Object.keys(authHeaders).length > 0, 'no auth headers for history');
    const payload = await requestJson('/users/me/history?page=1&pageSize=5', {
      headers: authHeaders
    });
    assert(Array.isArray(payload.items), 'history.items is not array');
    return {
      total: payload.pagination?.total ?? payload.items.length,
      sampleTypes: payload.items.slice(0, 5).map((item) => item.type)
    };
  }));

  results.push(await runCase('users.following', async () => {
    assert(Object.keys(authHeaders).length > 0, 'no auth headers for following');
    const payload = await requestJson('/users/me/following?page=1&pageSize=5', {
      headers: authHeaders
    });
    assert(Array.isArray(payload.items), 'following.items is not array');
    return {
      total: payload.pagination?.total ?? payload.items.length,
      sampleIds: payload.items.slice(0, 5).map((item) => item.id)
    };
  }));

  results.push(await runCase('messages.conversations', async () => {
    assert(Object.keys(authHeaders).length > 0, 'no auth headers for messages');
    const payload = await requestJson('/messages/conversations', {
      headers: authHeaders
    });
    assert(Array.isArray(payload), 'conversations payload is not array');
    return {
      total: payload.length,
      sampleIds: payload.slice(0, 5).map((item) => item.id)
    };
  }));

  results.push(await runCase('campus-services.multi-user-publish-and-list', async () => {
    const published = [];

    for (const seed of CAMPUS_SERVICE_TEST_ACCOUNTS) {
      const auth = await loginAccount(seed.account, seed.password);
      const now = Date.now();
      let payload;
      try {
        payload = await requestJson('/campus-services', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...auth.authHeaders
          },
          body: JSON.stringify({
            intent: seed.intent,
            pattern: seed.intent === 'OFFER' ? 'REUSABLE' : 'ONE_TIME',
            title: seed.title,
            category: seed.category,
            description: seed.description,
            priceMode: seed.priceMode,
            amount: seed.amount,
            ...(seed.priceMode === 'FREE' ? {} : { reward: seed.amount }),
            locationMode: 'FLEXIBLE',
            locationNote: seed.locationNote,
            validFromAt: new Date(now + 5 * 60 * 1000).toISOString(),
            validUntilAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
            estimatedMinutes: seed.intent === 'OFFER' ? 30 : 20,
            urgency: seed.intent === 'OFFER' ? 'NORMAL' : 'TODAY',
            fulfillmentMode: 'FLEXIBLE',
            itemCount: 1,
            maxTotalOrders: seed.intent === 'OFFER' ? 2 : 1,
            maxConcurrentOrders: 1,
            imageUrls: [getCampusServiceLocalImage(seed.category)]
          })
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`publish failed for ${seed.account} (${seed.category} / ${seed.title}): ${detail}`);
      }

      assert(payload?.id, `campus service id missing for ${seed.account}`);
      assert(payload?.intent === seed.intent, `campus service intent mismatch for ${seed.account}`);
      assert(typeof payload?.category === 'string' && payload.category.length > 0, `campus service category missing for ${seed.account}`);
      assert(
        !payload?.review?.selectedCategory || payload.review.selectedCategory === payload.category,
        `campus service review category mismatch for ${seed.account}`
      );

      const listPayload = await requestJson(`/campus-services?ownerId=${auth.user.id}&page=1&pageSize=12`, {
        headers: auth.authHeaders
      });
      assert(Array.isArray(listPayload.items), `campus service list is not array for ${seed.account}`);
      assert(
        listPayload.items.some((item) => item.id === payload.id && item.serviceType?.key === payload.category),
        `new campus service not found in owner list for ${seed.account}`
      );

      published.push({
        publisherId: auth.user.id,
        listingId: payload.id,
        requestedCategory: seed.category,
        intent: payload.intent,
        category: payload.category,
        reviewCategory: payload.review?.selectedCategory ?? null
      });
    }

    const categories = new Set(published.map((item) => item.category));
    const intents = new Set(published.map((item) => item.intent));
    const publishers = new Set(published.map((item) => item.publisherId));

    assert(categories.has('ERRAND'), 'ERRAND campus service missing from multi-user publish');
    assert(categories.has('MOVING'), 'MOVING campus service missing from multi-user publish');
    assert(categories.has('GROUP_BUY'), 'GROUP_BUY campus service missing from multi-user publish');
    assert(categories.has('HELP'), 'HELP campus service missing from multi-user publish');
    assert(categories.has('TUTORING'), 'TUTORING campus service missing from multi-user publish');
    assert(categories.has('REPAIR'), 'REPAIR campus service missing from multi-user publish');
    assert(categories.has('EVENT'), 'EVENT campus service missing from multi-user publish');
    assert(categories.has('AGENCY'), 'AGENCY campus service missing from multi-user publish');
    assert(categories.has('SKILL'), 'SKILL campus service missing from multi-user publish');
    assert(intents.has('REQUEST'), 'REQUEST campus service missing from multi-user publish');
    assert(intents.has('OFFER'), 'OFFER campus service missing from multi-user publish');
    assert(
      publishers.size >= CAMPUS_SERVICE_TEST_ACCOUNTS.length,
      `expected at least ${CAMPUS_SERVICE_TEST_ACCOUNTS.length} distinct campus service publishers`
    );

    const reclassified = published.filter((item) => item.requestedCategory !== item.category);

    return {
      count: published.length,
      publisherCount: publishers.size,
      categories: [...categories],
      intents: [...intents],
      reclassifiedCount: reclassified.length,
      reclassified,
      published
    };
  }));

  const passed = results.filter((item) => item.status === 'passed').length;
  const failed = results.length - passed;
  const summary = {
    apiBaseUrl: API_BASE_URL,
    executedAt: new Date().toISOString(),
    passed,
    failed,
    results
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
