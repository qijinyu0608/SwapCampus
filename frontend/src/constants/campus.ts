export const bjfuDorms = [
  '1号公寓',
  '2号公寓',
  '3号公寓',
  '4号公寓',
  '5号公寓',
  '6号公寓',
  '7号公寓',
  '8号公寓',
  '9号公寓',
  '10号公寓',
  '11号公寓',
  '12号公寓',
  '13号公寓'
] as const;

export const bjfuDiningSpots = [
  '学一食堂',
  '学二食堂',
  '学三食堂',
  '清真食堂',
  '沁园餐厅',
  '楸木园餐厅',
  '东区餐饮大楼',
  '西区餐饮大楼',
  '小食光'
] as const;

export const bjfuStudySpots = [
  '图书馆',
  '学术报告厅',
  '博物馆',
  '标本馆',
  '校史馆'
] as const;

export const bjfuTeachingSpots = [
  '主楼',
  '东配楼',
  '西配楼',
  '学研中心A座',
  '学研中心B座',
  '学研中心C座',
  '第一教学楼',
  '第二教学楼',
  '第三教学楼',
  '第四教学楼',
  '实验楼',
  '信息楼',
  '工程技术学院楼',
  '生物楼',
  '林学楼',
  '园林楼',
  '行政办公楼',
  '继续教育学院'
] as const;

export const bjfuServiceSpots = [
  '东门',
  '西门',
  '南门',
  '北门',
  '东北门',
  '校医院',
  '超市',
  '邮局',
  '学生活动中心',
  '创新创业中心'
] as const;

export const bjfuLandscapeSpots = [
  '银杏大道',
  '樱花大道',
  '中心草坪',
  '森林文化广场',
  '下沉广场'
] as const;

export const bjfuPopularMeetupSpots = [
  '图书馆',
  '学一食堂',
  '学研中心A座',
  '13号公寓',
  '东门',
  '银杏大道'
] as const;

export const bjfuLocationSections = [
  {
    label: '校门',
    items: ['东门', '西门', '南门', '北门', '东北门']
  },
  {
    label: '教学办公区',
    items: ['主楼', '东配楼', '西配楼', '学研中心A座', '学研中心B座', '学研中心C座', '第一教学楼', '第二教学楼', '第三教学楼', '第四教学楼', '实验楼', '信息楼', '工程技术学院楼', '生物楼', '林学楼', '园林楼', '行政办公楼']
  },
  {
    label: '图书与学术区',
    items: ['图书馆', '学术报告厅', '多功能厅', '博物馆', '标本馆', '校史馆']
  },
  {
    label: '食堂餐饮区',
    items: ['学一食堂', '学二食堂', '学三食堂', '清真食堂', '沁园餐厅', '楸木园餐厅', '东区餐饮大楼', '西区餐饮大楼', '小食光']
  },
  {
    label: '学生公寓区',
    items: ['1号公寓', '2号公寓', '3号公寓', '4号公寓', '5号公寓', '6号公寓', '7号公寓', '8号公寓', '9号公寓', '10号公寓', '11号公寓', '12号公寓', '13号公寓']
  },
  {
    label: '体育运动区',
    items: ['田家炳体育馆', '体育场', '足球场', '篮球场', '网球场', '羽毛球馆', '游泳馆', '健身中心']
  },
  {
    label: '生活服务区',
    items: ['校医院', '邮局', '超市', '浴室', '学生活动中心', '就业指导中心', '国际交流中心', '创新创业中心']
  },
  {
    label: '景观区',
    items: ['银杏大道', '樱花大道', '校友林', '树木园', '荷花池', '中心草坪', '校训石', '森林文化广场', '植物标本园', '溪山行旅庭院', '下沉广场']
  },
  {
    label: '校外关联地点',
    items: ['六道口地铁站', '清华东路', '学院路', '中国农业大学东校区', '清华大学', '北京语言大学']
  }
] as const;

export const bjfuServiceRoutePresets = [
  { label: '取件路线', from: '东门', to: '13号公寓' },
  { label: '带饭路线', from: '学一食堂', to: '图书馆' },
  { label: '打印路线', from: '学研中心B座', to: '主楼' },
  { label: '资料路线', from: '图书馆', to: '学研中心A座' },
  { label: '运动路线', from: '田家炳体育馆', to: '11号公寓' },
  { label: '快送路线', from: '西门', to: '行政办公楼' }
] as const;

export function getBjfuMeetupLabel(index: number) {
  return bjfuPopularMeetupSpots[index % bjfuPopularMeetupSpots.length];
}
