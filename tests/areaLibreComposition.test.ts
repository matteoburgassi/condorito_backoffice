import { describe, expect, it } from 'vitest';
import {
  AREA_LIBRE_COMPOSITION_TYPE,
  validateAreaLibreCompositionReferences,
  type CompositionSection,
} from '../src/lib/areaLibreComposition';

const config = {
  key: 'freemium_desktop_composition',
  variant: 'featured-left-secondary-stack',
  primaryKey: 'freemium_comics',
  secondaryKeys: ['freemium_chistes', 'freemium_subscription'],
  primaryGridCells: 8,
  gap: 24,
  secondaryGap: 16,
};

function section(
  id: string,
  key: string,
  overrides: Partial<CompositionSection> = {},
): CompositionSection {
  return {
    id,
    type: 'banner',
    config: { key },
    is_active: true,
    is_desktop: true,
    ...overrides,
  };
}

const siblings = [
  section('comics', 'freemium_comics', { type: 'comic-carousel' }),
  section('jokes', 'freemium_chistes', { type: 'joke-carousel' }),
  section('subscription', 'freemium_subscription'),
];

describe('validateAreaLibreCompositionReferences', () => {
  it('accepts the default active desktop freemium composition', () => {
    expect(validateAreaLibreCompositionReferences(config, {
      screenSlug: 'freemium',
      sections: siblings,
      isActive: true,
      isDesktop: true,
    })).toEqual({});
  });

  it('rejects use outside freemium or on mobile', () => {
    expect(validateAreaLibreCompositionReferences(config, {
      screenSlug: 'home',
      sections: siblings,
      isActive: true,
      isDesktop: false,
    })).toMatchObject({
      type: expect.any(String),
      is_desktop: expect.any(String),
    });
  });

  it('rejects missing, inactive, mobile, duplicate, and ambiguous references', () => {
    const sections = [
      section('comics', 'freemium_comics', { is_active: false }),
      section('jokes', 'freemium_chistes', { is_desktop: false }),
      section('subscription-1', 'freemium_subscription'),
      section('subscription-2', 'freemium_subscription'),
    ];
    expect(validateAreaLibreCompositionReferences(config, {
      screenSlug: 'freemium',
      sections,
      isActive: true,
      isDesktop: true,
    })).toMatchObject({
      primaryKey: expect.any(String),
      'secondaryKeys.0': expect.any(String),
      'secondaryKeys.1': expect.any(String),
    });
  });

  it('rejects overlapping references and another active desktop controller', () => {
    expect(validateAreaLibreCompositionReferences({
      ...config,
      secondaryKeys: ['freemium_comics'],
    }, {
      screenSlug: 'freemium',
      sections: [
        ...siblings,
        section('controller', 'other-controller', {
          type: AREA_LIBRE_COMPOSITION_TYPE,
        }),
      ],
      isActive: true,
      isDesktop: true,
    })).toMatchObject({
      type: expect.any(String),
      secondaryKeys: expect.any(String),
    });
  });
});
