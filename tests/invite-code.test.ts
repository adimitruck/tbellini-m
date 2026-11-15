import { describe, expect, it } from 'vitest';
import { INVITE_CODE_INPUT_PATTERN, generateInviteCode } from '../src/domain/invite-code';

describe('invite code input pattern', () => {
  it('compiles with the v flag browsers use for the pattern attribute', () => {
    const compiled = new RegExp(`^(?:${INVITE_CODE_INPUT_PATTERN})$`, 'v');
    expect(compiled.test(generateInviteCode())).toBe(true);
    expect(compiled.test('short')).toBe(false);
  });
});
