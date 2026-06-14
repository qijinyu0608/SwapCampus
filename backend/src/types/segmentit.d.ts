declare module 'segmentit' {
  export class Segment {
    doSegment(text: string, options?: { simple?: boolean }): unknown[];
  }

  export function useDefault<T extends Segment>(segment: T): T;
}
