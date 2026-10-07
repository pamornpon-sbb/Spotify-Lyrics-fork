import { expect, test } from 'vitest';

import { isLRCLIBId } from './lrclib';

test('lrclib id', () => {
  expect(isLRCLIBId(3205010 + 0.1)).toBe(true);
  expect(isLRCLIBId(1323911406)).toBe(false);
});
