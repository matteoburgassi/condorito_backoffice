export type SectionPlatform = 'mobile' | 'desktop';
export const DEFAULT_GRID_CELLS = 12;

export interface PlatformSection {
  position: number;
  is_desktop: boolean;
}

export function isDesktopPlatform(platform: SectionPlatform): boolean {
  return platform === 'desktop';
}

export function sectionsForPlatform<T extends PlatformSection>(
  sections: T[],
  platform: SectionPlatform,
): T[] {
  const desktop = isDesktopPlatform(platform);
  return sections.filter((section) => section.is_desktop === desktop);
}

export function nextSectionPosition(
  sections: PlatformSection[],
  isDesktop: boolean,
): number {
  return sections
    .filter((section) => section.is_desktop === isDesktop)
    .reduce((max, section) => Math.max(max, section.position), -1) + 1;
}

export function normalizeGridCells(value: unknown): number {
  return typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= DEFAULT_GRID_CELLS
    ? value
    : DEFAULT_GRID_CELLS;
}

export function withoutLegacyGridCells(config: unknown): unknown {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return config;
  const next = { ...(config as Record<string, unknown>) };
  delete next.gridCells;
  return next;
}
