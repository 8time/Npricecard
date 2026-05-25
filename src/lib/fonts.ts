import type { FontOption, StoredFont } from '../types';
import { loadStoredFonts, saveStoredFont } from './storage';

type BundledFontManifestItem = {
  name: string;
  family: string;
  file: string;
};

export const SYSTEM_FONTS: FontOption[] = [
  {
    id: 'system-yu-gothic',
    name: '游ゴシック',
    family: '"Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif',
    source: 'system',
  },
  {
    id: 'system-maru',
    name: '丸ゴシック',
    family: '"Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif',
    source: 'system',
  },
  {
    id: 'system-mincho',
    name: '明朝体',
    family: '"Yu Mincho", "Hiragino Mincho ProN", serif',
    source: 'system',
  },
];

export const DEFAULT_FONT_FAMILY = SYSTEM_FONTS[0].family;

const registerFontFace = async (family: string, source: string) => {
  if (!('FontFace' in window)) {
    return;
  }

  const fontFaceSet = document.fonts;
  const alreadyLoaded = [...fontFaceSet].some((fontFace) => fontFace.family === family);
  if (alreadyLoaded) {
    return;
  }

  const fontFace = new FontFace(family, `url(${source})`);
  await fontFace.load();
  fontFaceSet.add(fontFace);
};

export const loadBundledFonts = async (): Promise<FontOption[]> => {
  try {
    const response = await fetch('/fonts/manifest.json', { cache: 'no-cache' });
    if (!response.ok) {
      return [];
    }

    const manifest = (await response.json()) as BundledFontManifestItem[];
    const fonts = await Promise.all(
      manifest.map(async (item) => {
        const family = item.family || item.name;
        await registerFontFace(family, `/fonts/${item.file}`);
        return {
          id: `bundled-${family}`,
          name: item.name,
          family,
          source: 'bundled' as const,
        };
      }),
    );
    return fonts;
  } catch {
    return [];
  }
};

export const loadUploadedFonts = async (): Promise<StoredFont[]> => {
  const fonts = await loadStoredFonts();
  await Promise.all(fonts.map((font) => registerFontFace(font.family, font.dataUrl)));
  return fonts;
};

export const saveUploadedFont = async (file: File) => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const family = `Uploaded ${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const font: StoredFont = {
    id: `uploaded-${family}-${Date.now()}`,
    name: baseName,
    family,
    source: 'uploaded',
    dataUrl,
    fileName: file.name,
    createdAt: Date.now(),
  };

  await registerFontFace(font.family, font.dataUrl);
  await saveStoredFont(font);
  return font;
};
