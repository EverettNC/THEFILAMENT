/**
 * Tokens a default English model tends to shave, flatten, or "correct."
 * Train walks the map: Kentucky → Tennessee → Texas → Louisiana Creole/bayou →
 * Florida cracker → Washington hippies → Montana → Utah →
 * Vegas (oreo / Chinese / Mandarin) → Minnesota, Brooklyn, Bronx, Caribbean, Hawaiian, Thai.
 */

export const DIALECT_MAP = {
  kentucky: {
    label: "Kentucky",
    tokens: ["holler", "y'uns", "nigh", "reckon", "poke", "yonder", "ain't", "mash", "cain't"],
  },
  tennessee: {
    label: "Tennessee",
    tokens: ["holler", "reckon", "yonder", "ain't", "mash", "nigh", "y'uns", "cain't", "bless"],
  },
  texas: {
    label: "Texas drawl",
    tokens: ["howdy", "y'all", "fixin'", "over yonder", "darlin'", "pardner", "cain't", "might could", "all hat", "ma'am"],
  },
  louisiana: {
    label: "Louisiana Creole · bayou",
    tokens: [
      "cher",
      "sha",
      "lagniappe",
      "couyon",
      "envie",
      "boudin",
      "who dat",
      "yeah you right",
      "fais-dodo",
      "pirogue",
      "bayou",
      "gumbo",
      "zydeco",
      "ova",
      "dere",
      "dat",
      "dis",
    ],
  },
  florida: {
    label: "Florida cracker · hep · redneck",
    tokens: [
      "y'all",
      "ain't",
      "cain't",
      "fixin'",
      "yonder",
      "reckon",
      "might could",
      "palmetto",
      "gator",
      "hammock",
      "swamp",
      "hep",
      "cracker",
      "tain't",
      "sho nuff",
      "done told",
      "boy",
    ],
  },
  washington: {
    label: "Washington hippies",
    tokens: ["the mountain", "drizzle", "the pass", "spendy", "you bet", "copacetic", "far out", "rainier", "moss", "the island"],
  },
  montana: {
    label: "Montana",
    tokens: ["big sky", "huckleberry", "the divide", "you bet", "range", "the pass", "butte", "howdy"],
  },
  utah: {
    label: "Utah",
    tokens: ["the trail", "slickrock", "wash", "the lake", "ward", "pioneer", "mesa", "hoodoo", "desert"],
  },
  vegas: {
    label: "Vegas · oreo · Chinese · Mandarin",
    tokens: [
      "the strip",
      "comped",
      "whale",
      "high roller",
      "tap out",
      "bruh",
      "on god",
      "no cap",
      "you feel me",
      "straight up",
      "fam",
      "dim sum",
      "siu mai",
      "cha siu",
      "lai see",
      "m'goi",
      "ni-hao",
      "xie-xie",
      "hao",
      "ma",
      "dui",
      "mei-you",
    ],
  },
  minnesota: {
    label: "Minnesota",
    tokens: ["ope", "you betcha", "dontcha know", "uff-da", "hotdish", "yeah no", "no yeah"],
  },
  brooklyn: {
    label: "Brooklyn",
    tokens: ["madonn'", "gabagool", "fuhgeddabou", "oobatz", "bodega", "deadass", "yerr", "brick", "son"],
  },
  bronx: {
    label: "the Bronx",
    tokens: ["deadass", "bodega", "wallahi", "ock", "nahmean", "brick", "son", "fam", "good looks", "yerr"],
  },
  caribbean: {
    label: "Caribbean US",
    tokens: ["irie", "wagwan", "likkle", "yute", "mon", "ting", "bruh"],
  },
  hawaiian: {
    label: "Hawaiian Pidgin",
    tokens: ["da kine", "howzit", "pau", "mahalo", "bumbai"],
  },
  thai: {
    label: "Thai",
    tokens: ["sawasdee", "khrap", "ka", "nam prik", "pad krapow", "sabai"],
  },
} as const;

export type DialectRegion = keyof typeof DIALECT_MAP;

export const DIALECT_ORDER = Object.keys(DIALECT_MAP) as DialectRegion[];

export function dialectTokens(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of DIALECT_ORDER) {
    for (const token of DIALECT_MAP[key].tokens) {
      if (seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

export const SYLLABLES = dialectTokens();
export const KEYTERMS: string[] = SYLLABLES.filter((s) => s.length <= 50).slice(0, 100);
export const DIALECT_STIM = DIALECT_MAP.kentucky.tokens;

let stimIndex = 0;

export function nextDialectStim(): {
  key: DialectRegion;
  label: string;
  tokens: readonly string[];
} {
  const key = DIALECT_ORDER[stimIndex % DIALECT_ORDER.length]!;
  stimIndex += 1;
  const pack = DIALECT_MAP[key];
  return { key, label: pack.label, tokens: pack.tokens };
}

export const SAMPLE_CATCH = {
  text: "Y'all fixin' to come yonder to the holler? Cher, that's a lagniappe — ain't nobody cain't use a little extra. Bruh it was irie, a likkle ting. Madonn', the gabagool. Tak, děkuji. Ni-hao, xie-xie. Arigatō, chotto mate. Lawd have mercy, sugar.",
  rawText:
    "You all fixing to come yonder to the holler? Share, that's a lagniappe — ain't nobody cannot use a little extra. Bro it was irie, a little thing. Madonna, the capicola. Tak, thank you. Nihao, xiexie. Arigato, chotto mate. Lord have mercy, sugar.",
  register: "Gulf Coast / Caribbean / kitchen-table English",
  language: "en",
  duration: 14.2,
  caught: [
    "y'all",
    "fixin'",
    "yonder",
    "holler",
    "cher",
    "lagniappe",
    "ain't",
    "cain't",
    "bruh",
    "irie",
    "likkle",
    "madonn'",
    "gabagool",
    "ni-hao",
    "xie-xie",
    "lawd",
    "sugar",
  ],
  words: [
    { text: "Y'all", start: 0.1, end: 0.4 },
    { text: "fixin'", start: 0.45, end: 0.85 },
    { text: "to", start: 0.86, end: 0.98 },
    { text: "come", start: 0.99, end: 1.2 },
    { text: "yonder", start: 1.25, end: 1.7 },
    { text: "to", start: 1.72, end: 1.84 },
    { text: "the", start: 1.85, end: 1.96 },
    { text: "holler?", start: 2.0, end: 2.5 },
    { text: "Cher,", start: 3.0, end: 3.35 },
    { text: "that's", start: 3.4, end: 3.65 },
    { text: "a", start: 3.66, end: 3.74 },
    { text: "lagniappe", start: 3.8, end: 4.5 },
  ],
} as const;
