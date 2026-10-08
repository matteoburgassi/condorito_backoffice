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

export type LoginMethodPlatform = 'desktop' | 'mobile';

export type LoginMethodPlatforms = Record<LoginMethodPlatform, boolean>;

const DEFAULT_PLATFORMS: LoginMethodPlatforms = {
  desktop: true,
  mobile: true,
};

export function loginMethodLabel(type: string): string {
  switch (type) {
    case 'email_password':
      return 'Email and password';
    case 'msisdn_pin':
      return 'Mobile number and PIN';
    case 'msisdn_otp':
      return 'Mobile number and OTP';
    case 'msisdn_no_pin':
      return 'Mobile number (no PIN)';
    default:
      return type.split('_').join(' ');
  }
}

/**
 * Platforms where this method may be offered.
 * Missing `config.platforms` means both (backward compatible).
 */
export function getLoginMethodPlatforms(
  config: Record<string, unknown> | null | undefined,
): LoginMethodPlatforms {
  const raw = config?.platforms;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_PLATFORMS };
  }
  const platforms = raw as Record<string, unknown>;
  return {
    desktop: platforms.desktop !== false,
    mobile: platforms.mobile !== false,
  };
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

export function buildPlatformsUpdate(
  method: Pick<LoginMethodRow, 'config'>,
  platform: LoginMethodPlatform,
  enabled: boolean,
) {
  const platforms = {
    ...getLoginMethodPlatforms(method.config),
    [platform]: enabled,
  };
  return {
    config: {
      ...(method.config ?? {}),
      platforms,
    },
  };
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

/** An enabled method must stay available on at least one platform. */
export function validatePlatformChange(
  method: Pick<LoginMethodRow, 'enabled' | 'config'>,
  platform: LoginMethodPlatform,
  enabled: boolean,
): string | null {
  if (enabled || !method.enabled) return null;
  const next = {
    ...getLoginMethodPlatforms(method.config),
    [platform]: enabled,
  };
  if (!next.desktop && !next.mobile) {
    return 'Keep at least one platform (desktop or mobile) while this method is enabled.';
  }
  return null;
}
