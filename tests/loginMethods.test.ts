import { describe, expect, it } from 'vitest';
import {
  buildSignupUpdate,
  loginMethodLabel,
  validateEnabledChange,
  type LoginMethodRow,
} from '../src/lib/loginMethods';

function method(overrides: Partial<LoginMethodRow> = {}): LoginMethodRow {
  return {
    id: 'email',
    product_id: 'product',
    type: 'email_password',
    enabled: true,
    is_default: true,
    order: 1,
    allow_signup: true,
    config: { allow_forgot_password: true, custom: 'preserved' },
    ...overrides,
  };
}

describe('login method configuration helpers', () => {
  it('labels supported methods for administrators', () => {
    expect(loginMethodLabel('email_password')).toBe('Email and password');
    expect(loginMethodLabel('msisdn_pin')).toBe('Mobile number and PIN');
  });

  it('updates both signup flags without losing advanced configuration', () => {
    expect(buildSignupUpdate(method(), false)).toEqual({
      allow_signup: false,
      config: {
        allow_forgot_password: true,
        custom: 'preserved',
        allow_signup: false,
      },
    });
  });

  it('requires another default before disabling the current default', () => {
    const methods = [
      method(),
      method({ id: 'phone', type: 'msisdn_pin', is_default: false, order: 2 }),
    ];

    expect(validateEnabledChange(methods, 'email', false)).toBe(
      'Choose another default method before disabling this one.',
    );
  });

  it('keeps at least one method enabled', () => {
    const methods = [
      method({ is_default: false }),
      method({ id: 'phone', type: 'msisdn_pin', enabled: false, is_default: false }),
    ];

    expect(validateEnabledChange(methods, 'email', false)).toBe(
      'At least one login method must remain enabled.',
    );
    expect(validateEnabledChange(methods, 'email', true)).toBeNull();
  });
});
