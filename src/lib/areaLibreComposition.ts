import { asWidgetConfig, type WidgetConfig } from './widgetSchema';

export const AREA_LIBRE_COMPOSITION_TYPE = 'area-libre-composition';
export const AREA_LIBRE_COMPOSITION_VARIANT = 'featured-left-secondary-stack';

export interface CompositionSection {
  id: string;
  type: string;
  config: unknown;
  is_active: boolean;
  is_desktop: boolean;
}

interface ValidationContext {
  screenSlug: string;
  sections: CompositionSection[];
  currentSectionId?: string;
  isActive: boolean;
  isDesktop: boolean;
}

export function validateAreaLibreCompositionReferences(
  config: WidgetConfig,
  context: ValidationContext,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (context.screenSlug !== 'freemium') {
    errors.type = 'Area Libre composition is available only on the freemium screen.';
  }
  if (!context.isDesktop) {
    errors.is_desktop = 'Area Libre composition must be a desktop section.';
  }

  const otherActiveControllers = context.sections.filter((section) => (
    section.id !== context.currentSectionId
    && section.type === AREA_LIBRE_COMPOSITION_TYPE
    && section.is_active
    && section.is_desktop
  ));
  if (context.isActive && otherActiveControllers.length > 0) {
    errors.type = 'Only one active Area Libre composition is allowed.';
  }

  const siblingsByKey = new Map<string, CompositionSection[]>();
  for (const section of context.sections) {
    if (
      section.id === context.currentSectionId
      || section.type === AREA_LIBRE_COMPOSITION_TYPE
      || !section.is_active
      || !section.is_desktop
    ) {
      continue;
    }
    const key = asWidgetConfig(section.config).key;
    if (typeof key !== 'string' || !key.trim()) continue;
    const normalizedKey = key.trim();
    siblingsByKey.set(normalizedKey, [...(siblingsByKey.get(normalizedKey) ?? []), section]);
  }

  const primaryKey = typeof config.primaryKey === 'string' ? config.primaryKey.trim() : '';
  const secondaryKeys = Array.isArray(config.secondaryKeys)
    ? config.secondaryKeys.map((key) => typeof key === 'string' ? key.trim() : '')
    : [];

  const validateReference = (key: string, path: string) => {
    const matches = siblingsByKey.get(key) ?? [];
    if (matches.length === 0) errors[path] = 'must reference an active desktop section key';
    else if (matches.length > 1) errors[path] = 'is ambiguous because multiple active desktop sections use this key';
  };

  if (primaryKey) validateReference(primaryKey, 'primaryKey');
  secondaryKeys.forEach((key, index) => {
    if (key) validateReference(key, `secondaryKeys.${index}`);
  });

  const references = [primaryKey, ...secondaryKeys].filter(Boolean);
  if (new Set(references).size !== references.length) {
    errors.secondaryKeys = 'Primary and secondary widget keys must all be unique.';
  }

  return errors;
}
