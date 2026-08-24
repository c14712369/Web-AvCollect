/**
 * 常見知名中日女優名字對照表。
 * 用於將中文譯名與官網日文/假名相互對照比對。
 */
export const ACTRESS_NAME_MAP: Record<string, string[]> = {
  '三上悠亞': ['三上悠亜'],
  '吉澤明步': ['吉沢明歩'],
  '桃乃木香奈': ['桃乃木かな', '桃乃木香奈'],
  '深田詠美': ['深田えいみ', '深田詠美'],
  '葵司': ['葵つかさ', '葵司'],
  '葵伊吹': ['葵いぶき', '葵伊吹'],
  '葵いぶき': ['葵いぶき', '葵伊吹'],
  '篠崎沙帆': ['篠崎沙帆', '筱崎沙帆'],
  '相澤南': ['相沢みなみ', '相澤南', '相泽南'],
  '高橋聖子': ['高橋しょう子', '高橋聖子'],
  '河北彩花': ['河北彩花', '河北彩伽'],
  '河北彩伽': ['河北彩伽', '河北彩花'],
  '天海翼': ['天海つばさ', '天海翼'],
  '波多野結衣': ['波多野結衣'],
  '大槻響': ['大槻ひびき', '大槻響'],
  '小宵虎南': ['小宵こなん', '小宵虎南'],
  '山手梨愛': ['山手りあ', '山手梨愛'],
  '八掛海': ['八掛うみ', '八掛海'],
  '美谷朱里': ['美谷朱里'],
  '石原希望': ['石原希望'],
  '伊藤舞雪': ['伊藤舞雪'],
  '櫻空桃': ['桜空もも', '櫻空桃'],
  '明里紬': ['明里つむぎ', '明里紬'],
  '本庄鈴': ['本庄鈴'],
  '香水純': ['香水じゅん', '香水純'],
  '七澤米亞': ['七沢みあ', '七澤米亞', '七澤美亞', '七澤みあ'],
  '七澤美亞': ['七沢みあ', '七澤米亞', '七澤美亞', '七澤みあ'],
  '二宮沙樹': ['二宮さき', '二宮沙樹'],
  '唯井真尋': ['唯井まひろ', '唯井真尋'],
  '涼森玲夢': ['涼森れむ', '涼森玲夢'],
  '坂道みる': ['miru', '坂道みる', '坂道美琉'],
  '神宮寺奈緒': ['神宮寺ナオ', '神宮寺奈緒'],
  '架乃由羅': ['架乃ゆら', '架乃由羅'],
  '古川伊織': ['古川いおり', '古川伊織'],
  '楓可憐': ['楓カレン', '楓可憐', '枫可怜'],
  '愛才莉亞': ['愛才りあ', '愛才リア', '愛才莉亞', '爱才莉亚'],
  '明日葉三葉': ['明日葉みつは', '明日葉三葉', '明日叶三叶'],
  '小湊四葉': ['小湊よつば', '小湊四葉', '小凑四叶'],
  '松本一香': ['松本いちか', '松本一香'],
  '初美菜乃花': ['初美なのか', '初美菜乃花'],
  '淺野心': ['浅野こころ', '淺野心', '浅野心'],
  '白桃花': ['白桃はな', '白桃花'],
  '時田亞美': ['時田あみ', '時田亞美', '时田亚美'],
  '井上桃': ['井上もも', '井上桃'],
  '純白彩永': ['純白さえ', '純白彩永', '纯白彩永'],
  '鳳美優': ['鳳みゆ', '鳳美優', '凤美优'],
  '逢澤美優': ['逢沢みゆ', '逢澤美優', '逢泽美优'],
  '藍芽美月': ['藍芽みづき', '藍芽美月', '蓝芽美月'],
  '百永紗里奈': ['百永さりな', '百永紗里奈', '百永纱里奈'],
  '善場麻美': ['善場まみ', '善場麻美', '善场麻美'],
  '白峰美羽': ['白峰ミウ', '白峰美羽'],
  '輝星綺羅': ['輝星きら', '輝星綺羅', '辉星绮罗'],
  '三葉千春': ['三葉ちはる', '三葉千春', '三叶千春'],
  '花狩舞': ['花狩まい', '花狩舞'],
  '森日向子': ['森ひなこ', '森日向子'],
};

/**
 * 將中文漢字中的繁體/簡體字轉換成日文漢字。
 * 例如：亞 -> 亜, 澤 -> 沢 等。
 */
export function toJapaneseKanji(name: string): string {
  const map: Record<string, string> = {
    '亞': '亜', '亚': '亜',
    '澤': '沢', '泽': '沢',
    '步': '歩',
    '條': '条', '条': '条',
    '繪': '絵', '绘': '絵',
    '櫻': '桜', '樱': '桜',
    '實': '実', '实': '実',
    '鄉': '郷', '乡': '郷',
    '廣': '広', '广': '広',
    '齊': '斉', '齐': '斉',
    '齋': '斎', '斋': '斎',
    '瀧': '滝', '泷': '滝',
    '濱': '浜', '滨': '浜',
    '澀': '渋', '涩': '渋',
    '龍': '竜', '龙': '竜',
    '體': '体',
    '國': '国',
    '藝': '芸',
  };
  return name.split('').map(char => map[char] || char).join('');
}

/**
 * 取得一位女優的所有中日文變體（小寫且已去空格）。
 */
export function getActressVariants(prefName: string): string[] {
  const list = [prefName, toJapaneseKanji(prefName)];
  const upperPref = prefName.toUpperCase().trim();
  
  // 查找譯名對照表
  if (ACTRESS_NAME_MAP[prefName]) {
    list.push(...ACTRESS_NAME_MAP[prefName]);
  }
  
  // 反向查找
  for (const [zh, jpList] of Object.entries(ACTRESS_NAME_MAP)) {
    if (zh.toUpperCase() === upperPref || jpList.some(jp => jp.toUpperCase() === upperPref)) {
      list.push(zh, ...jpList);
    }
  }
  
  return Array.from(new Set(list.map(s => s.toLowerCase().trim()).filter(Boolean)));
}

/** actress 欄位的多人切割規則（與收藏限定下拉、喜愛女優篩選共用）。 */
export const ACTRESS_SPLIT_REGEX = /[\s,，、・]+/;

/**
 * 將多個 actress 欄位切割後，以中日變體歸一分組計數。
 * 回傳 { 顯示名: 出現次數 }；同一人的不同寫法（大小寫/譯名）合併為一組，
 * 顯示名取該組出現最多的原始寫法。計數邏輯必須與 matchActress 的歸一規則一致，
 * 否則下拉選單數字會與實際篩選結果不符。
 */
export function countActressAppearances(
  actressFields: (string | null | undefined)[]
): Record<string, number> {
  const groups = new Map<string, { total: number; forms: Map<string, number> }>();

  for (const field of actressFields) {
    if (!field) continue;
    for (const raw of field.split(ACTRESS_SPLIT_REGEX)) {
      const form = raw.trim();
      if (!form) continue;
      const key = getActressVariants(form).sort().join('|');
      let group = groups.get(key);
      if (!group) {
        group = { total: 0, forms: new Map() };
        groups.set(key, group);
      }
      group.total += 1;
      group.forms.set(form, (group.forms.get(form) || 0) + 1);
    }
  }

  const counts: Record<string, number> = {};
  for (const group of groups.values()) {
    let label = '';
    let best = -1;
    for (const [form, n] of group.forms) {
      if (n > best) {
        label = form;
        best = n;
      }
    }
    counts[label] = group.total;
  }
  return counts;
}

/**
 * 比對喜愛女優名與目標字串（標題/主演欄位等），支援中日變體與英文單字邊界防護。
 */
export function matchActress(prefName: string, targetText: string): boolean {
  if (!targetText) return false;
  const targetLower = targetText.toLowerCase();
  const variants = getActressVariants(prefName);
  
  return variants.some((variant) => {
    // 只有純 ASCII（英文名）需要單字邊界防護；
    // CJK/假名/長音/全形符號等一律用子字串比對（\b 在非 ASCII 字元旁永遠不成立）
    const isAscii = /^[\x00-\x7F]+$/.test(variant);
    if (!isAscii) {
      return targetLower.includes(variant);
    }
    const escaped = variant.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp('\\b' + escaped.replace(/\s+/g, '\\s+') + '\\b', 'i');
    return regex.test(targetLower);
  });
}
