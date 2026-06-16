import { describe, expect, it } from 'vitest';
import {
  bjfuDiningSpots,
  bjfuDorms,
  bjfuLandscapeSpots,
  bjfuLocationSections,
  bjfuPopularMeetupSpots,
  bjfuServiceRoutePresets,
  bjfuServiceSpots,
  bjfuStudySpots,
  bjfuTeachingSpots,
  getBjfuMeetupLabel
} from './campus';

describe('campus constants', () => {
  it('exposes the expected campus location groups and presets', () => {
    expect(bjfuDorms).toContain('13号公寓');
    expect(bjfuDiningSpots).toContain('学一食堂');
    expect(bjfuStudySpots).toContain('图书馆');
    expect(bjfuTeachingSpots).toContain('主楼');
    expect(bjfuServiceSpots).toContain('东门');
    expect(bjfuLandscapeSpots).toContain('银杏大道');
    expect(bjfuPopularMeetupSpots).toEqual([
      '图书馆',
      '学一食堂',
      '学研中心A座',
      '13号公寓',
      '东门',
      '银杏大道'
    ]);

    expect(bjfuLocationSections).toHaveLength(9);
    expect(bjfuLocationSections[0]).toEqual({
      label: '校门',
      items: ['东门', '西门', '南门', '北门', '东北门']
    });
    expect(bjfuLocationSections[1]?.items).toContain('学研中心C座');
    expect(bjfuLocationSections[2]?.items).toContain('多功能厅');
    expect(bjfuLocationSections[5]?.items).toContain('游泳馆');
    expect(bjfuLocationSections[7]?.items).toContain('溪山行旅庭院');
    expect(bjfuLocationSections[8]?.items).toContain('清华大学');

    expect(bjfuServiceRoutePresets).toEqual([
      { label: '取件路线', from: '东门', to: '13号公寓' },
      { label: '带饭路线', from: '学一食堂', to: '图书馆' },
      { label: '打印路线', from: '学研中心B座', to: '主楼' },
      { label: '资料路线', from: '图书馆', to: '学研中心A座' },
      { label: '运动路线', from: '田家炳体育馆', to: '11号公寓' },
      { label: '快送路线', from: '西门', to: '行政办公楼' }
    ]);
  });

  it('cycles meetup labels by index', () => {
    expect(getBjfuMeetupLabel(0)).toBe('图书馆');
    expect(getBjfuMeetupLabel(5)).toBe('银杏大道');
    expect(getBjfuMeetupLabel(6)).toBe('图书馆');
    expect(getBjfuMeetupLabel(13)).toBe('学一食堂');
  });
});
