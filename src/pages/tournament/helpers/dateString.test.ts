import { describe, it, expect } from 'vitest';
import { dateString } from './dateString';

describe('dateString', () => {
  it('formats same day', () => {
    let result: any = dateString({ startDate: '2025-03-15', endDate: '2025-03-15' });
    expect(result).toBe('March 15, 2025');
  });

  it('formats same month different days', () => {
    let result: any = dateString({ startDate: '2025-06-10', endDate: '2025-06-15' });
    expect(result).toBe('June 10-15, 2025');
  });

  it('formats same year different months', () => {
    let result: any = dateString({ startDate: '2025-06-28', endDate: '2025-07-04' });
    expect(result).toBe('June 28 - July 4, 2025');
  });

  it('formats different years', () => {
    let result: any = dateString({ startDate: '2025-12-28', endDate: '2026-01-04' });
    expect(result).toBe('2025/12/28 - 2026/1/4');
  });

  it('handles January (month index 0)', () => {
    let result: any = dateString({ startDate: '2025-01-01', endDate: '2025-01-01' });
    expect(result).toBe('January 1, 2025');
  });

  it('handles December (month index 11)', () => {
    let result: any = dateString({ startDate: '2025-12-25', endDate: '2025-12-31' });
    expect(result).toBe('December 25-31, 2025');
  });
});
