/**
 * 從番號 prefix 萃取廠商名。未知 prefix 回傳空字串（UI 端不顯示廠商標籤）。
 */
export function extractMaker(code: string): string {
  const prefix = code.split('-')[0].toUpperCase();

  const makerMap: Record<string, string> = {
    // S1 NO STYLE
    SNOS: 'S1', SSIS: 'S1', SONE: 'S1', SOE: 'S1', SORA: 'S1', SIVR: 'S1',
    // IDEAPOCKET
    IPZZ: 'IDEAPOCKET', IPX: 'IDEAPOCKET', IPVR: 'IDEAPOCKET', IPTD: 'IDEAPOCKET',
    JUFE: 'IDEAPOCKET', SUPA: 'IDEAPOCKET',
    // MOODYZ
    MIDA: 'MOODYZ', MIMK: 'MOODYZ', MIAA: 'MOODYZ', MIHD: 'MOODYZ',
    MIDE: 'MOODYZ', MIAE: 'MOODYZ', MIDV: 'MOODYZ', MIDD: 'MOODYZ',
    MIGD: 'MOODYZ', MIND: 'MOODYZ', MIAD: 'MOODYZ', MDYD: 'MOODYZ',
    // PREMIUM
    PRED: 'PREMIUM', PRWF: 'PREMIUM',
    // DAS
    DASS: 'DAS', DLDSS: 'DAS', DCDSS: 'DAS', DLVSS: 'DAS',
    // FALENO
    FNS: 'FALENO', FALO: 'FALENO', FSDSS: 'FALENO', FSVSS: 'FALENO', DSAM: 'FALENO',
    // E-BODY
    EBWH: 'E-BODY', EBOD: 'E-BODY', EBDV: 'E-BODY',
    // SOD
    STARS: 'SOD', START: 'SOD', STAR: 'SOD',
    SDMM: 'SOD', SDJS: 'SOD', SDAB: 'SOD', SDDE: 'SOD',
    SDNM: 'SOD', SDMU: 'SOD', SDAM: 'SOD',
    // MADONNA
    JUL: 'Madonna', JUR: 'Madonna', JUKD: 'Madonna',
    // KMP
    MKMP: 'KMP',
    // CAWAII
    CAWD: 'CAWAII', KAWD: 'CAWAII',
    // ABBA
    ABF: 'ABBA',
    // Attackers
    ATID: 'Attackers', SHKD: 'Attackers',
    // 蚊香社 Prestige
    ABW: 'Prestige', ABP: 'Prestige', MAAN: 'Prestige', MKCK: 'Prestige',
    MBW: 'Prestige', PPT: 'Prestige', OFJE: 'Prestige',
    // Wanz
    WANZ: 'Wanz Factory', WAAA: 'Wanz Factory',
    // Honnaka
    HMN: 'Honnaka',
    // Alice Japan
    AILB: 'Alice Japan',
    // S-Cute
    SMCD: 'S-Cute',
    // Maxing
    MAXA: 'Maxing',
    // Moon Force
    MOON: 'Moon Force',
    // MINGOs
    MNGS: 'MINGOs',
  };

  return makerMap[prefix] ?? '';
}

/**
 * 從標題萃取女優名（位於標題末尾，2-6 字 CJK 字元）。
 */
export function extractActress(title: string): string | null {
  const match = title.match(/(?:~|-|—|－|\s)([一-龥ぁ-んァ-ヶ]+)$/);
  if (match && match[1].length >= 2 && match[1].length <= 6) {
    return match[1].trim();
  }
  return null;
}

/**
 * 追蹤的主題標籤（與 AvBatch preferredTags 一致）。
 * 只回傳這份白名單中出現在標題的標籤；其他主題不顯示。
 */
const TRACKED_TAGS = ['校服', '白襪', '接吻', '3P', '女同', '百合', '制服', 'JK'] as const;

export function extractThemes(title: string): string[] {
  return TRACKED_TAGS.filter((tag) => title.includes(tag));
}
