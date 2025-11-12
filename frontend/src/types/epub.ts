/**
 * TypeScript definitions for epub.js library
 * Based on epubjs 0.3.93 API
 */

export interface EpubCFI {
  toString(): string;
}

export interface NavItem {
  id: string;
  href: string;
  label: string;
  subitems?: NavItem[];
  parent?: string;
}

export interface SpineItem {
  index: number;
  href: string;
  url: string;
  canonical: string;
  properties: string[];
  linear: string;
  prev(): SpineItem | undefined;
  next(): SpineItem | undefined;
}

export interface Location {
  index: number;
  href: string;
  start: {
    index: number;
    href: string;
    cfi: string;
    displayed: {
      page: number;
      total: number;
    };
    location: number;
    percentage: number;
  };
  end: {
    index: number;
    href: string;
    cfi: string;
    displayed: {
      page: number;
      total: number;
    };
    location: number;
    percentage: number;
  };
  atStart: boolean;
  atEnd: boolean;
}

export interface Rendition {
  display(target?: string | number): Promise<void>;
  prev(): Promise<void>;
  next(): Promise<void>;
  destroy(): void;
  themes: {
    default(styles: Record<string, string | number>): void;
    register(name: string, styles: Record<string, string | number>): void;
    select(name: string): void;
    fontSize(size: string): void;
  };
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback?: (...args: unknown[]) => void): void;
  currentLocation(): Location | null;
  annotations: {
    add(
      type: string,
      cfiRange: string,
      data?: Record<string, unknown>,
      cb?: () => void,
      className?: string,
      styles?: Record<string, string>
    ): void;
    remove(cfiRange: string, type: string): void;
    highlight(
      cfiRange: string,
      data?: Record<string, unknown>,
      cb?: () => void,
      className?: string,
      styles?: Record<string, string>
    ): void;
  };
  getRange(cfi: string): Range | null;
  getContents(): Contents[];
}

export interface Contents {
  window: Window;
  document: Document;
  content: HTMLElement;
  documentElement: HTMLElement;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback?: (...args: unknown[]) => void): void;
}

export interface Book {
  ready: Promise<void>;
  spine: {
    get(target: string | number): SpineItem | undefined;
    each(callback: (item: SpineItem) => void): void;
    items: SpineItem[];
    length: number;
  };
  navigation: {
    toc: NavItem[];
    landmarks: NavItem[];
    get(target: string): NavItem | undefined;
  };
  locations: {
    generate(chars?: number): Promise<void>;
    save(): string;
    load(locations: string): void;
    currentLocation(target: string): number;
    cfiFromLocation(location: number): string;
    locationFromCfi(cfi: string): number;
    total: number;
    length(): number;
  };
  rendition(options?: RenditionOptions): Rendition;
  coverUrl(): Promise<string | null>;
  loaded: {
    cover: Promise<string | null>;
    navigation: Promise<void>;
    metadata: Promise<void>;
  };
  packaging: {
    metadata: {
      title: string;
      creator: string;
      description: string;
      language: string;
      publisher: string;
      pubdate: string;
      direction: string;
    };
  };
  destroy(): void;
}

export interface RenditionOptions {
  width?: number | string;
  height?: number | string;
  ignoreClass?: string;
  manager?: string;
  view?: string;
  flow?: 'paginated' | 'scrolled' | 'scrolled-doc' | 'auto';
  layout?: string;
  spread?: 'none' | 'always' | 'auto';
  minSpreadWidth?: number;
  stylesheet?: string;
  resizeOnOrientationChange?: boolean;
  script?: string;
  snap?: boolean;
  defaultDirection?: 'ltr' | 'rtl';
  allowScriptedContent?: boolean;
}

export interface EpubSelection {
  cfiRange: string;
  text: string;
  range: Range;
}

export interface EpubDisplayEvent {
  href: string;
  index: number;
}

export interface EpubLocationEvent {
  start: {
    cfi: string;
    href: string;
    displayed: {
      page: number;
      total: number;
    };
    location: number;
    percentage: number;
  };
  end: {
    cfi: string;
    href: string;
    displayed: {
      page: number;
      total: number;
    };
    location: number;
    percentage: number;
  };
}

export interface EpubRenderedEvent {
  section: SpineItem;
  currentLocation?: Location;
}

// Type guards
export function isEpubSelection(obj: unknown): obj is EpubSelection {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'cfiRange' in obj &&
    'text' in obj &&
    'range' in obj
  );
}

export function isLocation(obj: unknown): obj is Location {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'start' in obj &&
    'end' in obj &&
    'atStart' in obj &&
    'atEnd' in obj
  );
}
