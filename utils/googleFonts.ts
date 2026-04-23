const SYSTEM_FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Georgia',
  'Palatino',
  'Garamond',
  'Impact',
];

export const GOOGLE_FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Raleway',
  'Nunito',
  'Nunito Sans',
  'Source Sans 3',
  'Work Sans',
  'DM Sans',
  'Manrope',
  'Urbanist',
  'Outfit',
  'Plus Jakarta Sans',
  'Rubik',
  'Mulish',
  'Quicksand',
  'Josefin Sans',
  'Barlow',
  'Cabin',
  'Karla',
  'Hind',
  'Mukta',
  'Noto Sans',
  'PT Sans',
  'Merriweather Sans',
  'Playfair Display',
  'Merriweather',
  'Libre Baskerville',
  'Cormorant Garamond',
  'Lora',
  'Bitter',
  'Crimson Text',
  'EB Garamond',
  'Oswald',
  'Bebas Neue',
  'Archivo Black',
  'Anton',
  'Fjalla One',
  'Bricolage Grotesque',
  'Space Grotesk',
  'Sora',
  'Lexend',
  'Figtree',
  'Alegreya Sans',
  'Titillium Web',
  'IBM Plex Sans',
  'IBM Plex Serif',
  'Inconsolata',
  'Roboto Mono',
  'JetBrains Mono',
  'Space Mono',
  'Caveat',
  'Dancing Script',
  'Pacifico',
  'Great Vibes',
];

export const TEXT_STYLE_FONTS = [
  ...GOOGLE_FONT_FAMILIES.map((font) => `${font}, sans-serif`),
  ...SYSTEM_FONT_FAMILIES,
];

const GOOGLE_FONT_LINK_ID = 'eventspacepro-google-fonts';
const GOOGLE_FONT_CHUNK_SIZE = 18;

const getGoogleFontName = (fontFamily: string) => {
  const firstFamily = fontFamily.split(',')[0]?.trim().replace(/^["']|["']$/g, '');
  return GOOGLE_FONT_FAMILIES.includes(firstFamily) ? firstFamily : null;
};

const buildGoogleFontsUrl = (families: string[]) => {
  const params = families
    .map((family) => `family=${encodeURIComponent(family).replace(/%20/g, '+')}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
};

export const getFontDisplayName = (fontFamily: string) => {
  return fontFamily.split(',')[0]?.trim().replace(/^["']|["']$/g, '') || fontFamily;
};

export const ensureGoogleFontsLoaded = (fontFamilies: string[] = TEXT_STYLE_FONTS) => {
  if (typeof document === 'undefined') return;

  const googleFonts = Array.from(
    new Set(fontFamilies.map(getGoogleFontName).filter(Boolean) as string[])
  );

  for (let index = 0; index < googleFonts.length; index += GOOGLE_FONT_CHUNK_SIZE) {
    const chunk = googleFonts.slice(index, index + GOOGLE_FONT_CHUNK_SIZE);
    const linkId = `${GOOGLE_FONT_LINK_ID}-${index / GOOGLE_FONT_CHUNK_SIZE}`;

    if (document.getElementById(linkId)) continue;

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = buildGoogleFontsUrl(chunk);
    document.head.appendChild(link);
  }
};
