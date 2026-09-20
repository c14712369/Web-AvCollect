export function getImageReferer(parsed: URL): string {
  if (parsed.hostname.includes('jable')) return 'https://jable.tv/';
  if (parsed.hostname.includes('fourhoi')) return 'https://missav.ai/';
  if (parsed.hostname.includes('javrate') || parsed.hostname.includes('avking')) return 'https://javrate.com/';
  if (parsed.hostname.includes('supjav')) return 'https://supjav.com/';
  return 'https://missav.com/';
}
