import { Item } from '../types';

/**
 * Normalizes Kurdish and Arabic text for robust fuzzy and duplicate searching.
 * Handles different Kurdish/Arabic letter representations, vowels, and numbers.
 */
export function normalizeKurdishArabicText(text: string = ''): string {
  if (!text) return '';

  let normalized = text.toLowerCase().trim();

  // Convert Kurdish/Arabic numbers to standard digits
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(arabicDigits[i], String(i));
    normalized = normalized.replaceAll(persianDigits[i], String(i));
  }

  // Normalize Kurdish & Arabic letter variations
  normalized = normalized
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ةه]/g, 'ە')
    .replace(/ؤ/g, 'و')
    .replace(/ۆ/g, 'و')
    .replace(/ڵ/g, 'ل')
    .replace(/ڕ/g, 'ر')
    .replace(/ڤ/g, 'ف')
    .replace(/[\u064B-\u065F\u0670]/g, ''); // Remove Arabic Tashkeel / diacritics

  // Remove punctuation, brackets, hyphens, and symbols
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"?؟،«»\[\]\\]/g, ' ');

  // Collapse multiple whitespace characters into a single space
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Computes standard Levenshtein distance between two strings
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Fast Autocomplete search for dropdown directly under the item name input.
 * Starts from the very 1st letter, prioritizing items whose first letter matches!
 * Deduplicates by unique item name.
 */
export function getAutocompleteItemSuggestions(
  query: string,
  allItems: Item[],
  limitCount: number = 10
): Item[] {
  const clean = query.trim();
  if (!clean) return [];

  const normQ = normalizeKurdishArabicText(clean);
  if (!normQ) return [];

  const seenNames = new Set<string>();
  const startsWithMatches: { item: Item; score: number }[] = [];
  const wordStartsMatches: { item: Item; score: number }[] = [];
  const containsMatches: { item: Item; score: number }[] = [];

  allItems.forEach((item) => {
    const rawName = (item.name || '').trim();
    if (!rawName) return;

    const normName = normalizeKurdishArabicText(rawName);
    if (seenNames.has(normName)) return; // Avoid duplicate names in suggestions

    const words = normName.split(' ').filter(Boolean);

    // 1. Starts with query (highest priority for "هەر پیتی یەکەم لێدەم")
    if (normName.startsWith(normQ)) {
      seenNames.add(normName);
      startsWithMatches.push({ item, score: 100 - normName.length });
      return;
    }

    // 2. Any word in the item name starts with the query (e.g. second word starts with letter)
    const wordIndex = words.findIndex((w) => w.startsWith(normQ));
    if (wordIndex !== -1) {
      seenNames.add(normName);
      wordStartsMatches.push({ item, score: 80 - wordIndex });
      return;
    }

    // 3. Contains query anywhere
    if (normName.includes(normQ)) {
      seenNames.add(normName);
      containsMatches.push({ item, score: 60 });
      return;
    }
  });

  startsWithMatches.sort((a, b) => b.score - a.score);
  wordStartsMatches.sort((a, b) => b.score - a.score);

  const combined = [
    ...startsWithMatches.map((m) => m.item),
    ...wordStartsMatches.map((m) => m.item),
    ...containsMatches.map((m) => m.item)
  ];

  return combined.slice(0, limitCount);
}

export interface SimilarItemMatch {
  item: Item;
  score: number; // 0 - 100
  matchType: 'exact_name' | 'high_similarity' | 'word_match';
  matchedReason: string;
}

/**
 * Searches for similar items in the catalog based on name or barcode
 */
export function findSimilarItems(
  nameQuery: string,
  barcodeQuery: string,
  allItems: Item[],
  currentEditingId?: string,
  minThreshold: number = 40
): SimilarItemMatch[] {
  const matches: SimilarItemMatch[] = [];

  const cleanName = nameQuery.trim();
  const cleanBarcode = barcodeQuery.trim();
  const normQuery = normalizeKurdishArabicText(cleanName);
  const queryTokens = normQuery.split(' ').filter(Boolean);

  if (!cleanName && !cleanBarcode) {
    return [];
  }

  allItems.forEach((item) => {
    // Exclude the item currently being edited
    if (currentEditingId && item.id === currentEditingId) return;

    const itemName = (item.name || '').trim();
    const normItemName = normalizeKurdishArabicText(itemName);
    const itemTokens = normItemName.split(' ').filter(Boolean);

    if (!cleanName || normQuery.length < 1) return;

    // 2. Starts with (from 1st letter)
    if (normItemName.startsWith(normQuery)) {
      matches.push({
        item,
        score: normItemName === normQuery ? 100 : 96,
        matchType: normItemName === normQuery ? 'exact_name' : 'high_similarity',
        matchedReason: normItemName === normQuery ? 'ناوی تەواو یەکسان' : `بە «${cleanName}» دەستپێدەکات`
      });
      return;
    }

    if (normQuery.length < 2) return;

    // 3. Substring containment
    if (normItemName.includes(normQuery) || normQuery.includes(normItemName)) {
      const shorter = Math.min(normQuery.length, normItemName.length);
      const longer = Math.max(normQuery.length, normItemName.length);
      const ratio = Math.round((shorter / longer) * 95);
      const score = Math.max(75, ratio);

      matches.push({
        item,
        score,
        matchType: 'high_similarity',
        matchedReason: normItemName.includes(normQuery)
          ? 'بەشێکە لە ناوی ئەم کاڵایە'
          : 'ناوی ئەم کاڵایە بەشێکە لە ناوی نوێکراوەکە'
      });
      return;
    }

    // 4. Token Overlap & Jaccard Calculation
    if (queryTokens.length > 0 && itemTokens.length > 0) {
      let commonTokensCount = 0;
      queryTokens.forEach((qToken) => {
        if (
          itemTokens.some((iToken) => {
            if (qToken === iToken) return true;
            if (qToken.length >= 3 && iToken.length >= 3) {
              const dist = levenshteinDistance(qToken, iToken);
              return dist <= 1;
            }
            return false;
          })
        ) {
          commonTokensCount++;
        }
      });

      const allTokensUnion = new Set([...queryTokens, ...itemTokens]).size;
      const jaccardScore = Math.round((commonTokensCount / allTokensUnion) * 100);
      const queryMatchRatio = Math.round((commonTokensCount / queryTokens.length) * 100);

      if (commonTokensCount >= 2 || (commonTokensCount === 1 && (queryTokens.length === 1 || itemTokens.length === 1))) {
        const combinedScore = Math.round((jaccardScore * 0.4) + (queryMatchRatio * 0.6));
        if (combinedScore >= minThreshold) {
          matches.push({
            item,
            score: Math.min(94, combinedScore),
            matchType: combinedScore >= 75 ? 'high_similarity' : 'word_match',
            matchedReason: `${commonTokensCount} وشەی هاوشێوەیان هەیە`
          });
          return;
        }
      }
    }
  });

  // Sort descending by score
  return matches.sort((a, b) => b.score - a.score);
}
