export type Vocab = { word: string; weight: number };

export type SourceToken = {
  raw: string;
  normalized: string;
  matchedTerm: string | null;
};

export type AnalysisToken = {
  raw: string;
  normalized: string;
  matchedTerm: string | null;
  hashIndex: number;
  blacklistMatch: boolean;
  sentimentWeight: number;
  bstTraversal: string[];
  cumulativeScore: number;
};

export type MessageAnalysis = {
  tokens: AnalysisToken[];
  toxicityScore: number;
  blacklisted: boolean;
  severeMatch: boolean;
  flagged: boolean;
  recognizedCount: number;
};

export const HASH_BUCKETS = 3;
export const ESCALATION_THRESHOLD = 0.4;
export const SEVERE_LANGUAGE_THRESHOLD = 0.92;

export const blacklist = ['malware', 'ransomware', 'exploit'];
const blacklistIndex = new Set(blacklist);

const terms = new Map<string, number>();

function addTerms(weight: number, words: string) {
  for (const word of words.split(/\s+/).filter(Boolean)) {
    const previous = terms.get(word);
    if (previous === undefined || Math.abs(weight) > Math.abs(previous)) {
      terms.set(word, weight);
    }
  }
}

// Positive terms have negative weights: they reduce the average toxicity signal.
addTerms(-0.35, 'fine okay ok alright acceptable decent average ordinary normal typical');
addTerms(-0.48, 'good nice pleasant useful solid cool calm friendly fair');
addTerms(-0.62, 'great happy helpful kind safe successful effective reliable honest respectful supportive grateful thankful appreciate appreciated enjoy enjoyed love loved');
addTerms(-0.76, 'excellent wonderful fantastic amazing awesome superb brilliant perfect delightful outstanding beautiful');

addTerms(0, 'hello hi hey goodbye bye neutral');

addTerms(0.35, 'mediocre underwhelming lacking unclear awkward dull stale tedious inconvenient unfavorable unhelpful');
addTerms(0.42, 'bad poor weak flawed messy annoying irritating bothersome frustrating uncomfortable unpleasant unfortunate undesirable boring disappointing disappointed unhappy sad upset worried anxious stressful confusing confused unsatisfactory questionable subpar harsh severe negative');
addTerms(0.5, 'lousy crummy shabby sloppy lame dismal bleak regrettable distressing problematic inadequate imperfect unkind unwise');
addTerms(0.5, 'concerned concernedness mediocrely troubling troublesome frustratingly faulty clumsy careless gloomy lonely regretful nervous fearful worriedness');
addTerms(0.58, 'lazy foolish clueless immature childish selfish greedy arrogant ignorant rude mean failure fail failing failed mistake mistakes problem problems issue issues broken unreliable messy pathetic');
addTerms(0.66, 'dumb stupid useless trash garbage crap suck sucks sucked loser coward creep ugly gross smelly obnoxious offensive vulgar obscene filthy foul rotten corrupt dishonest deceptive shameless selfishness greed cruel');
addTerms(0.74, 'idiot idiotic moron moronic jerk jerks nasty hostile aggressive toxic abusive bullying bully harass harassed harassment threatening threaten threat hurt hurts hurting injured injury assault attacked attack violence violent brutal brutality savage evil wicked sinister dangerous harmful damaging destructive loathe loathes loathing resent resentment disgusting repulsive revolting');
addTerms(0.82, 'awful terrible horrible horrendous horrific hideous dreadful abysmal appalling outrageous disgraceful shameful contemptible despicable repugnant loathsome heinous vile detest detests detested despise despises despised hatred hateful hate furious rage enraged malicious maliciously incompetent inept unqualified worthless hopeless miserable wretched deplorable appalling atrocious scornful degrading humiliating demeaning intimidating menacing');
addTerms(0.86, 'reprehensible unbearable unacceptable disastrous catastrophic treacherous treachery betrayal betrayer vicious detestable');
addTerms(0.9, 'asshole bastard bitch cunt motherfucker fucker fuckwit dumbfuck dipshit shithead shitbag shithole horseshit bullshit scumbag slimeball douchebag dickhead prick twat wanker tosser arsehole asswipe goddamn goddamned rape rapist murderer murder');
addTerms(0.96, 'fuck fucked fucking fucks motherfucking shit shitty shits bitchy bitches cuntish slut whore sluts whores');
addTerms(0.72, 'damn damned dammit hell piss pissed pissy bugger bollocks arse bloody');
addTerms(0.78, 'kill kills killed killing die dies dying death threaten threat assault stalk stalker stalking choke stab stabbed stabbing shoot shooting bomb bombing');
addTerms(0.84, 'killjoy scumbags creeps losers idiots morons fools fraud fraudster scammer scam dishonest liar lies lied lying');
addTerms(0.88, 'murderous slaughter massacre tortured torture torturing sadistic barbaric bloodthirsty');
addTerms(0.84, 'racist racism sexist sexism homophobic xenophobic transphobic ableist bigoted bigotry discriminatory discrimination misogynistic misogyny');

// Common direct insults and explicit profanity are intentionally high severity.
addTerms(0.94, 'dick prickhead jackass jackasses dumbass assholes bastards bitches scumbags douchebags shitheads shitbags fuckers motherfuckers');
addTerms(0.98, 'cunts cunting rapists raping');
addTerms(0.94, 'asshole bastard bitch cunt motherfucker fucker fuckwit dumbfuck dipshit shithead shitbag shithole horseshit bullshit scumbag slimeball douchebag dickhead prick twat wanker tosser arsehole asswipe goddamn goddamned');

// A small neutral seed keeps the original greeting example represented in the BST.
addTerms(0, 'hello');
addTerms(0.78, 'worse worst');

export const vocabulary: Vocab[] = [...terms.entries()]
  .map(([word, weight]) => ({ word, weight }))
  .sort((a, b) => a.word.localeCompare(b.word));

const vocabularyIndex = new Map(vocabulary.map((entry) => [entry.word, entry]));

const aliases: Record<string, string> = {
  a55: 'ass',
  a55hole: 'asshole',
  'a$$hole': 'asshole',
  arseholes: 'arsehole',
  btch: 'bitch',
  btches: 'bitch',
  bitches: 'bitch',
  b1tch: 'bitch',
  fck: 'fuck',
  fcker: 'fucker',
  fuk: 'fuck',
  fuker: 'fucker',
  fuking: 'fuck',
  fukking: 'fuck',
  fuq: 'fuck',
  sh1t: 'shit',
  sht: 'shit',
  shyt: 'shit',
  shity: 'shitty',
  fcking: 'fuck',
  hated: 'hate',
  hating: 'hate',
  horribly: 'horrible',
  biatch: 'bitch',
  bytch: 'bitch',
  mofo: 'motherfucker',
  mf: 'motherfucker',
  dumbasses: 'dumbass',
  assholes: 'asshole',
  idiots: 'idiot',
  morons: 'moron',
  losers: 'loser',
};

const negationWords = new Set([
  'not', 'no', 'never', 'neither', 'nor', 'without', 'hardly', 'barely',
  "don't", 'dont', "doesn't", 'doesnt', "didn't", 'didnt', "isn't", 'isnt',
  "aren't", 'arent', "wasn't", 'wasnt', "weren't", 'werent', "can't", 'cant',
  'cannot', "won't", 'wont', "wouldn't", 'wouldnt', "shouldn't", 'shouldnt',
  "couldn't", 'couldnt', "ain't", 'aint',
]);

const intensifiers = new Set([
  'very', 'really', 'so', 'extremely', 'incredibly', 'utterly', 'absolutely',
  'totally', 'fucking', 'damn', 'especially', 'completely',
]);

function removeDiacritics(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '');
}

export function normalizeWord(value: string) {
  return removeDiacritics(value)
    .toLocaleLowerCase('en-US')
    .replace(/[’‘]/g, "'")
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z0-9']/g, '');
}

function removeDoubledEnding(value: string) {
  return /(.)\1$/.test(value) ? value.slice(0, -1) : value;
}

function inflectionCandidates(word: string) {
  const candidates: string[] = [];
  const add = (candidate: string) => {
    if (candidate && candidate !== word && !candidates.includes(candidate)) candidates.push(candidate);
  };

  if (word.length > 4 && word.endsWith('ies')) add(`${word.slice(0, -3)}y`);
  if (word.length > 4 && word.endsWith('ied')) add(`${word.slice(0, -3)}y`);

  if (word.length > 5 && word.endsWith('ing')) {
    const root = word.slice(0, -3);
    add(root);
    add(removeDoubledEnding(root));
    add(`${root}e`);
    add(`${removeDoubledEnding(root)}e`);
  }

  if (word.length > 4 && word.endsWith('ed')) {
    const root = word.slice(0, -2);
    add(root);
    add(removeDoubledEnding(root));
    add(`${root}e`);
    add(`${removeDoubledEnding(root)}e`);
  }

  if (word.length > 4 && word.endsWith('ly')) {
    add(word.slice(0, -2));
    add(`${word.slice(0, -2)}e`);
  }
  if (word.length > 5 && word.endsWith('ness')) add(word.slice(0, -4));
  if (word.length > 5 && word.endsWith('ful')) add(word.slice(0, -3));
  if (word.length > 6 && word.endsWith('less')) add(word.slice(0, -4));

  if (word.length > 4 && word.endsWith('es')) {
    add(word.slice(0, -2));
    add(word.slice(0, -1));
  }
  if (word.length > 4 && word.endsWith('s')) add(word.slice(0, -1));

  if (word.length > 5 && word.endsWith('er')) {
    const root = word.slice(0, -2);
    add(root);
    add(removeDoubledEnding(root));
  }
  if (word.length > 6 && word.endsWith('est')) {
    const root = word.slice(0, -3);
    add(root);
    add(removeDoubledEnding(root));
  }

  return candidates;
}

export function resolveLexiconTerm(value: string): string | null {
  const word = normalizeWord(value);
  const alias = aliases[word];
  if (alias && vocabularyIndex.has(alias)) return alias;
  if (vocabularyIndex.has(word)) return word;
  for (const candidate of inflectionCandidates(word)) {
    if (vocabularyIndex.has(candidate)) return candidate;
  }
  return null;
}

function isKnownOrStructuralToken(word: string) {
  return vocabularyIndex.has(word)
    || resolveLexiconTerm(word) !== null
    || blacklistIndex.has(word)
    || negationWords.has(word);
}

export function tokenize(text: string): SourceToken[] {
  const chunks = text.match(/\S+/gu) ?? [];
  const output: SourceToken[] = [];

  for (const raw of chunks) {
    const normalized = normalizeWord(raw);
    if (!normalized) continue;

    // Keep punctuation-wrapped and intentionally obfuscated known words together.
    if (isKnownOrStructuralToken(normalized)) {
      output.push({ raw, normalized, matchedTerm: resolveLexiconTerm(normalized) });
      continue;
    }

    // Split unknown punctuation-joined text instead of accidentally merging words.
    const parts = raw.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
    if (parts.length > 1) {
      for (const part of parts) {
        const partNormalized = normalizeWord(part);
        if (partNormalized) {
          output.push({
            raw: part,
            normalized: partNormalized,
            matchedTerm: resolveLexiconTerm(partNormalized),
          });
        }
      }
    } else {
      output.push({ raw, normalized, matchedTerm: resolveLexiconTerm(normalized) });
    }
  }

  return output;
}

export const hashWord = (word: string) =>
  [...word].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0) % HASH_BUCKETS;

type TreeNode = Vocab & { left: TreeNode | null; right: TreeNode | null };

function buildBalancedTree(entries: Vocab[]): TreeNode | null {
  if (!entries.length) return null;
  const middle = Math.floor(entries.length / 2);
  return {
    ...entries[middle],
    left: buildBalancedTree(entries.slice(0, middle)),
    right: buildBalancedTree(entries.slice(middle + 1)),
  };
}

const vocabularyTree = buildBalancedTree(vocabulary);

export function treePath(term: string) {
  const path: string[] = [];
  let current = vocabularyTree;
  while (current) {
    path.push(current.word);
    if (term === current.word) return { node: current, path };
    current = term < current.word ? current.left : current.right;
  }
  return { node: undefined, path };
}

const previewPositions = [
  { x: 240, y: 14, parentIndex: null },
  { x: 125, y: 68, parentIndex: 0 },
  { x: 355, y: 68, parentIndex: 0 },
  { x: 70, y: 137, parentIndex: 1 },
  { x: 180, y: 137, parentIndex: 1 },
  { x: 300, y: 137, parentIndex: 2 },
  { x: 410, y: 137, parentIndex: 2 },
] as const;

const previewNodes = [
  vocabularyTree,
  vocabularyTree?.left,
  vocabularyTree?.right,
  vocabularyTree?.left?.left,
  vocabularyTree?.left?.right,
  vocabularyTree?.right?.left,
  vocabularyTree?.right?.right,
];

export const vocabularyTreePreview = previewNodes.flatMap((node, index) =>
  node
    ? [{
        index,
        parentIndex: previewPositions[index].parentIndex,
        word: node.word,
        weight: node.weight,
        x: previewPositions[index].x,
        y: previewPositions[index].y,
      }]
    : [],
);

function isNegated(tokens: SourceToken[], index: number) {
  return tokens
    .slice(Math.max(0, index - 3), index)
    .some((token) => negationWords.has(token.normalized));
}

function isIntensified(tokens: SourceToken[], index: number) {
  return tokens
    .slice(Math.max(0, index - 2), index)
    .some((token) => intensifiers.has(token.normalized));
}

export function analyzeMessage(text: string): MessageAnalysis {
  const sourceTokens = tokenize(text);
  let cumulativeScore = 0;

  const tokens = sourceTokens.map((token, index): AnalysisToken => {
    const lookupTerm = token.matchedTerm ?? token.normalized;
    const { node, path } = treePath(lookupTerm);
    const blacklistMatch = blacklistIndex.has(token.normalized);
    let sentimentWeight = node?.weight ?? 0;

    if (node && isNegated(sourceTokens, index)) {
      sentimentWeight = sentimentWeight > 0
        ? -sentimentWeight * 0.5
        : -sentimentWeight * 0.85;
    } else if (sentimentWeight > 0 && isIntensified(sourceTokens, index)) {
      sentimentWeight = Math.min(1, sentimentWeight * 1.2);
    }

    cumulativeScore += sentimentWeight;
    return {
      ...token,
      hashIndex: hashWord(token.normalized),
      blacklistMatch,
      sentimentWeight,
      bstTraversal: path,
      cumulativeScore,
    };
  });

  const recognized = tokens.filter((token) => token.matchedTerm !== null);
  const average = recognized.length
    ? Math.max(0, Math.min(1, cumulativeScore / recognized.length))
    : 0;
  const blacklisted = tokens.some((token) => token.blacklistMatch);
  const severeMatch = tokens.some((token) => token.sentimentWeight >= SEVERE_LANGUAGE_THRESHOLD);
  const toxicityScore = blacklisted
    ? 1
    : severeMatch
      ? Math.max(average, 0.85)
      : average;

  return {
    tokens,
    toxicityScore,
    blacklisted,
    severeMatch,
    flagged: blacklisted || toxicityScore >= ESCALATION_THRESHOLD,
    recognizedCount: recognized.length,
  };
}