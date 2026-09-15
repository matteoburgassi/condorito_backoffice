export type LoginMethodRow = {
  id: string;
  product_id: string;
  type: string;
  enabled: boolean;
  is_default: boolean;
  order: number;
  allow_signup: boolean;
  config: Record<string, unknown> | null;
};

export function loginMethodLabel(type: string): string {
  switch (type) {
    case 'email_password':
      return 'Email and password';
    case 'msisdn_pin':
      return 'Mobile number and PIN';
    default:
      return type.split('_').join(' ');
  }
}

export function buildSignupUpdate(
  method: Pick<LoginMethodRow, 'config'>,
  allowSignup: boolean,
) {
  return {
    allow_signup: allowSignup,
    config: {
      ...(method.config ?? {}),
      allow_signup: allowSignup,
    },
  };
}

export function getMsisdnRegex(method: Pick<LoginMethodRow, 'config'>): string {
  const value = method.config?.msisdn_regex;
  return typeof value === 'string' ? value : '';
}

export function validateMsisdnRegex(
  pattern: string,
  method: Pick<LoginMethodRow, 'config'>,
): string | null {
  if (!pattern.trim()) return null;

  const configuredFlags = method.config?.msisdn_regex_flags;
  const flags = typeof configuredFlags === 'string' ? configuredFlags : '';
  try {
    new RegExp(pattern, flags);
    return null;
  } catch {
    return 'Enter a valid regular expression.';
  }
}

export function buildMsisdnRegexUpdate(
  method: Pick<LoginMethodRow, 'config'>,
  pattern: string,
): Pick<LoginMethodRow, 'config'> {
  const config = { ...(method.config ?? {}) };
  if (pattern.trim()) {
    config.msisdn_regex = pattern;
  } else {
    delete config.msisdn_regex;
  }
  return { config };
}

export function validateEnabledChange(
  methods: LoginMethodRow[],
  methodId: string,
  enabled: boolean,
): string | null {
  if (enabled) return null;

  const method = methods.find((candidate) => candidate.id === methodId);
  if (!method?.enabled) return null;
  if (method.is_default) {
    return 'Choose another default method before disabling this one.';
  }
  if (methods.filter((candidate) => candidate.enabled).length <= 1) {
    return 'At least one login method must remain enabled.';
  }
  return null;
}
