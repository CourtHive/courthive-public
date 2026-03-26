import { describe, it, expect } from 'vitest';
import { isFunction, isString, isArray, isObject } from './typeof';

describe('isFunction', () => {
  it('returns true for functions', () => {
    expect(isFunction(() => {})).toBe(true);
    expect(isFunction(function () {})).toBe(true);
    expect(isFunction(Math.max)).toBe(true);
  });

  it('returns false for non-functions', () => {
    expect(isFunction('hello')).toBe(false);
    expect(isFunction(42)).toBe(false);
    expect(isFunction(null)).toBe(false);
    expect(isFunction(undefined)).toBe(false);
    expect(isFunction({})).toBe(false);
  });
});

describe('isString', () => {
  it('returns true for strings', () => {
    expect(isString('')).toBe(true);
    expect(isString('hello')).toBe(true);
  });

  it('returns false for non-strings', () => {
    expect(isString(42)).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
    expect(isString([])).toBe(false);
  });
});

describe('isArray', () => {
  it('returns true for arrays', () => {
    expect(isArray([])).toBe(true);
    expect(isArray([1, 2, 3])).toBe(true);
  });

  it('returns false for non-arrays', () => {
    expect(isArray({})).toBe(false);
    expect(isArray('hello')).toBe(false);
    expect(isArray(null)).toBe(false);
  });
});

describe('isObject', () => {
  it('returns true for plain objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ key: 'value' })).toBe(true);
  });

  it('returns false for arrays', () => {
    expect(isObject([])).toBe(false);
  });

  it('returns true for null (known limitation)', () => {
    // typeof null === 'object' and !Array.isArray(null) === true
    expect(isObject(null)).toBe(true);
  });

  it('returns false for primitives', () => {
    expect(isObject('hello')).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject(undefined)).toBe(false);
  });
});
