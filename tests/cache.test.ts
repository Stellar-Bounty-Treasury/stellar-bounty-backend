import { describe, it, expect } from 'vitest';
import { memoryCache } from '../src/services/memoryCache.js';

describe('Stellar Bounty Treasury Backend API — In-Memory Cache Suite', () => {
  it('stores and retrieves values within TTL', () => {
    memoryCache.set('test_key', { count: 42 }, 1000);
    const val = memoryCache.get<{ count: number }>('test_key');
    expect(val?.count).toBe(42);
  });

  it('invalidates cache keys by prefix', () => {
    memoryCache.set('stats:1', { a: 1 }, 5000);
    memoryCache.set('stats:2', { a: 2 }, 5000);
    memoryCache.set('other:1', { a: 3 }, 5000);

    memoryCache.invalidate('stats:');
    expect(memoryCache.get('stats:1')).toBeNull();
    expect(memoryCache.get('stats:2')).toBeNull();
    expect(memoryCache.get('other:1')).not.toBeNull();
  });
});
