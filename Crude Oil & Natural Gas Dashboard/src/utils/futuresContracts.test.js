import { describe, it, expect } from 'vitest';
import { getContractInfo } from './futuresContracts.js';

describe('getContractInfo', () => {
  it('resolves the front-month contract for a date early in the month', () => {
    // Matches the actual historical CME roll: front month WTI on 2024-04-05 was May 2024 (CLK24).
    const info = getContractInfo('2024-04-05', 1);
    expect(info.ticker).toBe('CLK24');
    expect(info.label).toBe('May 2024');
  });

  it('resolves the 4th month out as 3 months past the front month', () => {
    const info = getContractInfo('2024-04-05', 4);
    expect(info.ticker).toBe('CLQ24');
    expect(info.label).toBe('Aug 2024');
  });

  it('rolls the delivery year forward correctly across a December/January boundary', () => {
    const info = getContractInfo('2024-11-25', 1);
    expect(info.deliveryYear).toBe(2025);
    expect(info.ticker).toBe('CLF25');
  });
});
