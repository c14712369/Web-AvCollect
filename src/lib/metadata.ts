export function extractMaker(code: string): string {
  const prefix = code.split('-')[0].toUpperCase();
  
  const makerMap: Record<string, string> = {
    // S1 NO STYLE
    'SNOS': 'S1 NO STYLE', 'SSIS': 'S1 NO STYLE', 'SOE': 'S1 NO STYLE', 'SORA': 'S1 NO STYLE',
    // IDEAPOCKET
    'IPZZ': 'IDEAPOCKET', 'IPX': 'IDEAPOCKET', 'JUFE': 'IDEAPOCKET', 'SUPA': 'IDEAPOCKET',
    // MOODYZ
    'MIDA': 'MOODYZ', 'MIMK': 'MOODYZ', 'MIAA': 'MOODYZ', 'MIHD': 'MOODYZ',
    // PREMIUM
    'PRED': 'PREMIUM', 'PRWF': 'PREMIUM',
    // DAS
    'DASS': 'DAS', 'DLDSS': 'DAS',
    // FALENO
    'FNS': 'FALENO', 'FALO': 'FALENO', 'FSDSS': 'FALENO',
    // E-BODY
    'EBWH': 'E-BODY',
    // SOD
    'STARS': 'SOD', 'START': 'SOD', 'STAR': 'SOD', 'SDMM': 'SOD', 'SDJS': 'SOD', 'SDAB': 'SOD',
    // MADONNA
    'JUL': 'Madonna', 'JUR': 'Madonna',
    // MOON FORCE
    'MOON': 'Moon Force',
    // KMP
    'MKMP': 'KMP',
    // CAWAII
    'CAWD': 'CAWAII',
    // ABBA
    'ABF': 'ABBA',
    // MINGOs
    'MNGS': 'MINGOs',
    // ALICE JAPAN
    'AILB': 'Alice Japan',
    // S-CUTE
    'SMCD': 'S-Cute',
    // MAXING
    'MAXA': 'Maxing',
    // WAAN
    'WAAA': 'Wanz Factory',
  };

  return makerMap[prefix] || prefix;
}

export function extractActress(title: string): string | null {
  // 嘗試從標題末尾提取女優名字（通常在標題最後，可能是 ~ 女優名 或 空格 女優名）
  const match = title.match(/(?:~|-|—|－|\s)([一-龥ぁ-んァ-ヶ]+)$/);
  if (match && match[1].length >= 2 && match[1].length <= 6) {
    return match[1].trim();
  }
  return null;
}

export function extractThemes(title: string): string[] {
  const themes = new Set<string>();
  const upperTitle = title.toUpperCase();

  const themeRules = [
    { keywords: ['巨乳', '大乳', 'KCUP', 'G罩杯', 'H罩杯', 'I罩杯', 'J罩杯', '爆乳', '豐滿'], tag: '巨乳' },
    { keywords: ['人妻', '妻', '旦那', '太太', '家庭主婦', '婚外情', '出軌'], tag: '人妻' },
    { keywords: ['NTR', '寢取', '寝取られ', '背叛'], tag: 'NTR' },
    { keywords: ['輪姦', '輪●', '群交', '多男', '多人'], tag: '多人/輪姦' },
    { keywords: ['教師', '老師', '先生', '補習', '輔導'], tag: '教師' },
    { keywords: ['護士', 'ナース', '護理', '住院'], tag: '護士' },
    { keywords: ['學生', '女子大生', '女子高生', 'J●', 'JK', '校服', '制服', '同學'], tag: '學生' },
    { keywords: ['近親', '妹', '姊', '姐姐', '母', '娘', '繼母', '義父', '爸爸', '姑姑'], tag: '家族/近親' },
    { keywords: ['痴女', '痴漢', '痴●', '變態'], tag: '痴漢/痴女' },
    { keywords: ['中出', '內射', '射精', '無保護', '無套'], tag: '無套/中出' },
    { keywords: ['潮吹', '噴水', '失禁', '痙攣'], tag: '潮吹' },
    { keywords: ['素人', '業餘', '初攝'], tag: '素人' },
    { keywords: ['OL', '秘書', '公司', '上司', '員工', '社長', '出差'], tag: 'OL/職場' },
    { keywords: ['按摩', 'SPA', '推拿', '指交'], tag: '按摩' },
    { keywords: ['絲襪', '連褲襪', '黑絲'], tag: '絲襪' },
  ];

  themeRules.forEach(rule => {
    if (rule.keywords.some(kw => upperTitle.includes(kw))) {
      themes.add(rule.tag);
    }
  });

  return Array.from(themes);
}