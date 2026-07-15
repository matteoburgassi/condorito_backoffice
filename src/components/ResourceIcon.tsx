import {
  Boxes,
  BookOpen,
  GalleryHorizontal,
  Smile,
  Users,
  LayoutGrid,
  Gamepad2,
  Languages,
  Globe,
  Settings,
  Flag,
  Image,
  Palette,
  Menu,
  PanelBottom,
  type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  boxes: Boxes,
  'book-open': BookOpen,
  'gallery-horizontal': GalleryHorizontal,
  smile: Smile,
  users: Users,
  'layout-grid': LayoutGrid,
  'gamepad-2': Gamepad2,
  languages: Languages,
  globe: Globe,
  settings: Settings,
  flag: Flag,
  image: Image,
  palette: Palette,
  menu: Menu,
  'panel-bottom': PanelBottom,
};

export function ResourceIcon({ name, size = 17 }: { name: string; size?: number }) {
  const Cmp = MAP[name] ?? Boxes;
  return <Cmp size={size} />;
}
