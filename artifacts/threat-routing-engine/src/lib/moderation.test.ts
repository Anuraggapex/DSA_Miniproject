import { strict as assert } from 'node:assert';
import {
  analyzeMessage,
  normalizeWord,
  resolveLexiconTerm,
  tokenize,
  vocabulary,
} from './moderation.ts';

assert.ok(vocabulary.length >= 200, `expected a broad lexicon, got ${vocabulary.length} terms`);

for (const word of ['awful', 'terrible', 'disgusting', 'useless', 'incompetent', 'pathetic', 'moronic', 'vile']) {
  const result = analyzeMessage(`This is ${word}.`);
  assert.equal(result.flagged, true, `${word} should be flagged`);
  assert.ok(result.toxicityScore >= 0.4, `${word} should cross the escalation threshold`);
}

const abusive = analyzeMessage('You are a fucking asshole, you pathetic piece of shit.');
assert.equal(abusive.flagged, true);
assert.equal(abusive.severeMatch, true);
assert.ok(abusive.toxicityScore >= 0.85);

const variants = tokenize('F.U.C.K sh1t a$$hole b!tches hated horribly');
assert.deepEqual(
  variants.map((token) => token.matchedTerm),
  ['fuck', 'shit', 'asshole', 'bitch', 'hate', 'horrible'],
);
assert.equal(normalizeWord('sh1t!!!'), 'shit');
assert.equal(resolveLexiconTerm('idiots'), 'idiot');
assert.equal(resolveLexiconTerm('hating'), 'hate');

const negated = analyzeMessage('I do not hate it; this is not bad.');
assert.equal(negated.flagged, false, 'nearby negation should soften negative words');
assert.equal(analyzeMessage('not good').flagged, true, 'negated positive terms should add a mild negative signal');

const positive = analyzeMessage('Hello, that was a good and excellent result!');
assert.equal(positive.flagged, false);
assert.equal(analyzeMessage('The class is classic, not bad.').flagged, false, 'substrings must not count as toxic words');

const payload = analyzeMessage('The ransomware exploit contains malware.');
assert.equal(payload.blacklisted, true);
assert.equal(payload.toxicityScore, 1);

console.log(`Moderation checks passed (${vocabulary.length} lexicon terms).`);