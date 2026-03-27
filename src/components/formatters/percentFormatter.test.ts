import { describe, it, expect } from 'vitest';
import { percentFormatter } from './percentFormatter';

// Mock Tabulator cell with getValue()
const mockCell = (value: any) => ({ getValue: () => value });

describe('percentFormatter', () => {
  it('formats decimal as whole percentage', () => {
    expect(percentFormatter(mockCell(0.75))).toBe('75%');
    expect(percentFormatter(mockCell(1.0))).toBe('100%');
    expect(percentFormatter(mockCell(0.333))).toBe('33%');
  });

  it('formats string numbers', () => {
    expect(percentFormatter(mockCell('0.5'))).toBe('50%');
  });

  it('returns falsy for null/undefined/0', () => {
    expect(percentFormatter(mockCell(null))).toBeFalsy();
    expect(percentFormatter(mockCell(undefined))).toBeFalsy();
    expect(percentFormatter(mockCell(0))).toBeFalsy();
  });
});
