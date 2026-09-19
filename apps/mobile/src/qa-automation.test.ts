import { describe, expect, it } from 'vitest';
import {
  isQaAutomationEnabled,
  parseRevenueCatQaUrl,
  revenueCatQaStatusLabel,
} from './qa-automation';

describe('RevenueCat QA automation', () => {
  it('requires both a development build and the explicit QA flag', () => {
    expect(isQaAutomationEnabled(true, true)).toBe(true);
    expect(isQaAutomationEnabled(true, false)).toBe(false);
    expect(isQaAutomationEnabled(false, true)).toBe(false);
  });

  it('parses only the dedicated RevenueCat QA deep links', () => {
    expect(parseRevenueCatQaUrl('wheresthemoney://qa/revenuecat/open-plan?run=abc-123')).toEqual({
      action: 'open-plan',
      run: 'abc-123',
    });
    expect(parseRevenueCatQaUrl('wheresthemoney://qa/revenuecat/restore?run=restore%201')).toEqual({
      action: 'restore',
      run: 'restore 1',
    });
    expect(parseRevenueCatQaUrl('wheresthemoney://qa/revenuecat/state')).toEqual({
      action: 'state',
      run: 'none',
    });
  });

  it('rejects unrelated or malformed links', () => {
    expect(parseRevenueCatQaUrl('https://example.com/qa/revenuecat/state')).toBeNull();
    expect(parseRevenueCatQaUrl('wheresthemoney://qa/revenuecat/delete')).toBeNull();
    expect(parseRevenueCatQaUrl('wheresthemoney://qa/revenuecat/state?run=%E0%A4%A')).toBeNull();
  });

  it('exposes RevenueCat state as a stable native accessibility label for UI automation', () => {
    expect(revenueCatQaStatusLabel(false, false)).toBe('QA RevenueCat Status configured=false isPro=false');
    expect(revenueCatQaStatusLabel(true, false)).toBe('QA RevenueCat Status configured=true isPro=false');
    expect(revenueCatQaStatusLabel(true, true)).toBe('QA RevenueCat Status configured=true isPro=true');
  });
});
