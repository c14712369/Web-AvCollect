import 'dotenv/config';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { appConfig } from './schema';

const TRACKED_TAGS = ['校服', '白襪', '接吻', '3P', '女同', '百合', '制服', 'JK'];

const MAKER_MAP: Record<string, string> = {
  // S1
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
  // Prestige
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
  // FC2
  FC2: 'FC2 PPV',
};

const PREFERRED_ISSUERS = [
  'SSIS', 'SNIS', 'SIVR', 'SOE', 'ONSD',
  'MIDE', 'MIAE', 'MDED', 'MIGD', 'MIDV', 'MIDA', 'MIAD', 'MIMW', 'MIND', 'MDYD',
  'STARS', 'SDDE', 'SDJS', 'SDNM', 'SDMU', 'SDAM', 'SDAB', 'STAR', 'START',
  'CAWD', 'KAWD',
  'IPX', 'IPZ', 'IPTD', 'IPVR', 'IPZZ',
  'ABW', 'ABP', 'MAAN', 'MKCK', 'MBW', 'PPT', 'OFJE',
  'FSDSS', 'DSAM', 'FSVSS',
  'JUL', 'JUKD',
  'DLDSS', 'DCDSS', 'DHLA', 'DLVSS',
  'EBOD', 'EBDV', 'EBWH',
  'PRED',
  'ATID', 'SHKD',
  'WANZ',
  'HMN',
];

const PREFERRED_ACTRESSES = [
  '河北彩伽', '石川澪', '宮下玲奈', '葵いぶき', '八木奈々', '石原希望', '櫻空桃', '相澤南',
  '楓可憐', '涼森玲夢', '八掛海', 'うんぱい',
  '青空光', '本庄鈴', '小倉由菜', '小湊四葉', '星乃莉子', '柏木小夏', '松本一香', '虹村由美',
  '愛才莉亞', '香水純', '三田真鈴', '安達夕莉',
  'miru', '初美菜乃花', '新木希空', '博多彩葉', '瀨戶環奈', '淺野心', '七澤美亞', '白桃花',
  '明里紬', '時田亞美', '紗倉真菜', '天神羽衣',
  '井上桃', '純白彩永', '鳳美優', '白上咲花', '柴崎春', '神宮寺奈緒', '逢澤美優', '藍芽美月',
  '翼舞', '山岸綺花', '村上悠華', '日向夏',
  '矢埜愛茉', '百永紗里奈', '善場麻美', '白峰美羽', '榊原萌', '輝星綺羅', '山田鈴奈', '三葉千春',
  '花狩舞', '森日向子', '明日葉三葉',
];

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client);

  const entries: Array<[string, unknown]> = [
    ['tracked_tags', TRACKED_TAGS],
    ['maker_map', MAKER_MAP],
    ['preferred_issuers', PREFERRED_ISSUERS],
    ['preferred_actresses', PREFERRED_ACTRESSES],
    ['blocked_actresses', []],
    ['blocked_issuers', []],
    ['blocked_tags', []],
  ];

  for (const [key, value] of entries) {
    const json = JSON.stringify(value);
    await db
      .insert(appConfig)
      .values({ key, value: json })
      .onConflictDoUpdate({
        target: appConfig.key,
        set: { value: json, updatedAt: new Date() },
      });
    console.log(`Seeded config: ${key}`);
  }

  console.log('Config seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
