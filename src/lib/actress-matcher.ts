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

/**
 * 比對喜愛女優名與目標字串（標題/主演欄位等），支援中日變體與英文單字邊界防護。
 */
export function matchActress(prefName: string, targetText: string): boolean {
  if (!targetText) return false;
  const targetLower = targetText.toLowerCase();
  const variants = getActressVariants(prefName);
  
  return variants.some((variant) => {
    const isCjk = /^[一-防ぁ-んァ-ヶ\s]+$/.test(variant);
    if (isCjk) {
      return targetLower.includes(variant);
    }
    // 英文變體加單字邊界保護
    const escaped = variant.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp('\\b' + escaped.replace(/\s+/g, '\\s+') + '\\b', 'i');
    return regex.test(targetLower);
  });
}
