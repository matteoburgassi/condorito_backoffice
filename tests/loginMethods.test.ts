import { describe, expect, it } from 'vitest';
import {
  buildMsisdnRegexUpdate,
  buildSignupUpdate,
  getMsisdnRegex,
  loginMethodLabel,
  validateEnabledChange,
  validateMsisdnRegex,
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

  it('reads a configured MSISDN regex', () => {
    expect(
      getMsisdnRegex(method({ config: { msisdn_regex: '^\\+56[0-9]+$' } })),
    ).toBe('^\\+56[0-9]+$');
    expect(getMsisdnRegex(method({ config: null }))).toBe('');
  });

  it('validates an MSISDN regex with its configured flags', () => {
    const phoneMethod = method({ config: { msisdn_regex_flags: 'i' } });

    expect(validateMsisdnRegex('^\\+[0-9]+$', phoneMethod)).toBeNull();
    expect(validateMsisdnRegex('', phoneMethod)).toBeNull();
    expect(validateMsisdnRegex('[', phoneMethod)).toBe(
      'Enter a valid regular expression.',
    );
    expect(
      validateMsisdnRegex('^\\+[0-9]+$', method({ config: { msisdn_regex_flags: '[' } })),
    ).toBe('Enter a valid regular expression.');
  });

  it('updates the MSISDN regex without losing advanced configuration', () => {
    const phoneMethod = method({
      config: {
        msisdn_regex: '^old$',
        msisdn_regex_flags: 'i',
        msisdn_min_length: 9,
      },
    });

    expect(buildMsisdnRegexUpdate(phoneMethod, '^\\+[1-9][0-9]{7,14}$')).toEqual({
      config: {
        msisdn_regex: '^\\+[1-9][0-9]{7,14}$',
        msisdn_regex_flags: 'i',
        msisdn_min_length: 9,
      },
    });
  });

  it('removes an empty MSISDN regex while preserving other configuration', () => {
    const phoneMethod = method({
      config: {
        msisdn_regex: '^old$',
        msisdn_regex_flags: '',
        custom: 'preserved',
      },
    });

    expect(buildMsisdnRegexUpdate(phoneMethod, '   ')).toEqual({
      config: {
        msisdn_regex_flags: '',
        custom: 'preserved',
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
