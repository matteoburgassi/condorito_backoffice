import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GRID_CELLS,
  isDesktopPlatform,
  nextSectionPosition,
  normalizeGridCells,
  sectionsForPlatform,
  withoutLegacyGridCells,
} from '../src/lib/screenSections';

const sections = [
  { id: 'm1', position: 0, is_desktop: false },
  { id: 'd1', position: 0, is_desktop: true },
  { id: 'm2', position: 2, is_desktop: false },
  { id: 'd2', position: 4, is_desktop: true },
];

describe('screen section platforms', () => {
  it('filters independent mobile and desktop lists', () => {
    expect(sectionsForPlatform(sections, 'mobile').map(({ id }) => id)).toEqual(['m1', 'm2']);
    expect(sectionsForPlatform(sections, 'desktop').map(({ id }) => id)).toEqual(['d1', 'd2']);
  });

  it('calculates the next position within the selected platform', () => {
    expect(nextSectionPosition(sections, false)).toBe(3);
    expect(nextSectionPosition(sections, true)).toBe(5);
    expect(nextSectionPosition([], false)).toBe(0);
    expect(nextSectionPosition([], true)).toBe(0);
  });

  it('maps the selected UI platform to the database flag', () => {
    expect(isDesktopPlatform('mobile')).toBe(false);
    expect(isDesktopPlatform('desktop')).toBe(true);
  });

  it('normalizes section grid cells and defaults invalid values to twelve', () => {
    expect(normalizeGridCells(6)).toBe(6);
    expect(normalizeGridCells(undefined)).toBe(DEFAULT_GRID_CELLS);
    expect(normalizeGridCells(0)).toBe(DEFAULT_GRID_CELLS);
    expect(normalizeGridCells(13)).toBe(DEFAULT_GRID_CELLS);
    expect(normalizeGridCells(6.5)).toBe(DEFAULT_GRID_CELLS);
    expect(normalizeGridCells('6')).toBe(DEFAULT_GRID_CELLS);
  });

  it('removes the legacy top-level config field without changing nested values', () => {
    expect(withoutLegacyGridCells({
      gridCells: 6,
      title: 'Widget',
      action: { gridCells: 3 },
    })).toEqual({
      title: 'Widget',
      action: { gridCells: 3 },
    });
  });
});
