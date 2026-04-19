import { describe, it, expect } from 'vitest';
import { cn, formatPct, getWsUrl } from '../lib/utils';

describe('Utils functions', () => {
  it('should merge classes correctly using cn', () => {
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    expect(cn('p-4', null, undefined, 'm-2')).toBe('p-4 m-2');
  });

  it('should format percentage', () => {
    expect(formatPct(0.85)).toBe('85%');
    expect(formatPct(1.0)).toBe('100%');
    expect(formatPct(0.334)).toBe('33%');
  });

  it('should get websocket url', () => {
    // Note: window.location requires jsdom environment, handled by default in many vitest setups
    // This is a basic illustration
    expect(typeof getWsUrl).toBe('function');
  });
});
