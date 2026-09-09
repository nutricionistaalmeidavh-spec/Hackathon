import { describe, expect, it } from 'vitest';
import { parseNativeDataCommand } from './mobileDataBridge';

describe('mobile data bridge command parser', () => {
  it('accepts state, navigation and categorization commands', () => {
    expect(parseNativeDataCommand({ type: 'WTM_PORTABLE_REQUEST_STATE' })).toEqual({ type: 'WTM_PORTABLE_REQUEST_STATE' });
    expect(parseNativeDataCommand({ type: 'WTM_PORTABLE_NAVIGATE', tab: 'radar' })).toEqual({ type: 'WTM_PORTABLE_NAVIGATE', tab: 'radar' });
    expect(parseNativeDataCommand({ type: 'WTM_PORTABLE_CATEGORIZE', id: 'tx-1', category: 'Combustível' })).toEqual({
      type: 'WTM_PORTABLE_CATEGORIZE',
      id: 'tx-1',
      category: 'Combustível',
    });
  });

  it('rejects malformed commands', () => {
    expect(parseNativeDataCommand({ type: 'WTM_PORTABLE_NAVIGATE', tab: 'unknown' })).toBeNull();
    expect(parseNativeDataCommand({ type: 'WTM_PORTABLE_CATEGORIZE', id: '', category: 'Outros' })).toBeNull();
    expect(parseNativeDataCommand({ type: 'WTM_PORTABLE_CATEGORIZE', id: 'tx-1', category: '' })).toBeNull();
    expect(parseNativeDataCommand({ type: 'OTHER' })).toBeNull();
  });
});
