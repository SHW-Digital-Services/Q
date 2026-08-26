import { crisisDirectory } from '../data/crisisHelplines';
export function detectUserCountry(profileCountry?: string): string {
  const explicit = profileCountry?.trim().toUpperCase();
  if (explicit && crisisDirectory[explicit]) return explicit;
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || navigator.language;
    const region = typeof Intl.Locale === 'function' ? new Intl.Locale(locale).region : locale.match(/[-_]([A-Z]{2})\b/i)?.[1];
    return region && crisisDirectory[region.toUpperCase()] ? region.toUpperCase() : 'GLOBAL';
  } catch (error) { console.warn('[Q Locale] Country detection unavailable:', error); return 'GLOBAL'; }
}
