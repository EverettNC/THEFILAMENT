/** Filament dialect tour. Train walks one region at a time.
 * Kentucky → Tennessee → Texas → Louisiana Creole/bayou →
 * Florida cracker → Washington hippies → Montana → Utah →
 * Vegas (oreo / Chinese / Mandarin) → the rest of the map.
 */
(function (root) {
  const MAP = [
    { key: "kentucky", label: "Kentucky", tokens: ["holler", "y'uns", "nigh", "reckon", "poke", "yonder", "ain't", "mash", "cain't"] },
    { key: "tennessee", label: "Tennessee", tokens: ["holler", "reckon", "yonder", "ain't", "mash", "nigh", "y'uns", "cain't", "bless"] },
    { key: "texas", label: "Texas drawl", tokens: ["howdy", "y'all", "fixin'", "over yonder", "darlin'", "pardner", "cain't", "might could", "all hat", "ma'am"] },
    {
      key: "louisiana",
      label: "Louisiana Creole · bayou",
      tokens: ["cher", "sha", "lagniappe", "couyon", "envie", "boudin", "who dat", "yeah you right", "fais-dodo", "pirogue", "bayou", "gumbo", "zydeco", "ova", "dere", "dat", "dis"],
    },
    {
      key: "florida",
      label: "Florida cracker · hep · redneck",
      tokens: ["y'all", "ain't", "cain't", "fixin'", "yonder", "reckon", "might could", "palmetto", "gator", "hammock", "swamp", "hep", "cracker", "tain't", "sho nuff", "done told", "boy"],
    },
    {
      key: "washington",
      label: "Washington hippies",
      tokens: ["the mountain", "drizzle", "the pass", "spendy", "you bet", "copacetic", "far out", "rainier", "moss", "the island"],
    },
    {
      key: "montana",
      label: "Montana",
      tokens: ["big sky", "huckleberry", "the divide", "you bet", "range", "the pass", "butte", "howdy"],
    },
    {
      key: "utah",
      label: "Utah",
      tokens: ["the trail", "slickrock", "wash", "the lake", "ward", "pioneer", "mesa", "hoodoo", "desert"],
    },
    {
      key: "vegas",
      label: "Vegas · oreo · Chinese · Mandarin",
      tokens: [
        "the strip", "comped", "whale", "high roller", "tap out",
        "bruh", "on god", "no cap", "you feel me", "straight up", "fam",
        "dim sum", "siu mai", "cha siu", "lai see", "m'goi",
        "ni-hao", "xie-xie", "hao", "ma", "dui", "mei-you",
      ],
    },
    { key: "minnesota", label: "Minnesota", tokens: ["ope", "you betcha", "dontcha know", "uff-da", "hotdish", "yeah no", "no yeah"] },
    { key: "brooklyn", label: "Brooklyn", tokens: ["madonn'", "gabagool", "fuhgeddabou", "oobatz", "bodega", "deadass", "yerr", "brick", "son"] },
    { key: "bronx", label: "the Bronx", tokens: ["deadass", "bodega", "wallahi", "ock", "nahmean", "brick", "son", "fam", "good looks", "yerr"] },
    { key: "caribbean", label: "Caribbean US", tokens: ["irie", "wagwan", "likkle", "yute", "mon", "ting", "bruh"] },
    { key: "hawaiian", label: "Hawaiian Pidgin", tokens: ["da kine", "howzit", "pau", "mahalo", "bumbai"] },
    { key: "thai", label: "Thai", tokens: ["sawasdee", "khrap", "ka", "nam prik", "pad krapow", "sabai"] },
  ];

  let i = 0;
  let queue = [];
  let current = MAP[0];

  function nextPack() {
    current = MAP[i % MAP.length];
    i += 1;
    queue = current.tokens.slice();
    root.filamentRegion = current.label;
    return current;
  }

  function nextToken() {
    if (!queue.length) nextPack();
    return queue.shift();
  }

  nextPack();
  root.FILAMENT_MAP = MAP;
  root.FILAMENT_NEXT_PACK = nextPack;
  root.FILAMENT_NEXT_TOKEN = nextToken;
  root.filamentRegion = current.label;
})(window);
