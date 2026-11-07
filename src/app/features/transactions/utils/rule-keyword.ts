/** The fewest characters a suggested keyword may have before it is thought too short to be useful. */
const MIN_KEYWORD_LENGTH = 3;

/**
 * US state codes that end a card statement's "CITY ST" tail. Codes that are also common words
 * (CO as in "company", IN, OR, ME, OK, HI, AL, ID, MA, DE, LA) are left out, so a merchant name
 * that ends in one of them is not cut.
 */
const LOCATION_STATES: ReadonlySet<string> = new Set([
  'AK',
  'AZ',
  'AR',
  'CA',
  'CT',
  'FL',
  'GA',
  'IL',
  'IA',
  'KS',
  'KY',
  'MD',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
]);

/** At least this many words are needed before a trailing "CITY ST" is cut, so a name is not eaten. */
const MIN_WORDS_FOR_LOCATION_TAIL = 4;

/**
 * One keyword from a description: the description itself, or when it has commas (which the rule
 * form reads as separate OR keywords) its longest comma-separated part, trimmed. That part is still
 * in the description, so the transaction it came from still matches.
 */
export function singleKeyword(description: string): string {
  if (!description.includes(',')) return description;
  return description
    .split(',')
    .map((part: string): string => part.trim())
    .reduce((longest: string, part: string): string =>
      part.length > longest.length ? part : longest,
    );
}

/** Whitespace-separated words of a text, without empty ones. */
function words(text: string): string[] {
  return text.split(/\s+/).filter((word: string): boolean => word.length > 0);
}

/**
 * The part of a description before its first reference number, with a trailing "CITY ST" removed.
 * A word with a digit ends the keyword; if the digit follows a star ("PRIME*DV0OW5RJ3"), the
 * letters before the star are kept. May return fewer characters than a keyword needs, even nothing.
 */
function trimToName(description: string): string {
  const kept: string[] = [];
  for (const word of words(singleKeyword(description))) {
    if (!/\d/.test(word)) {
      kept.push(word);
      continue;
    }
    const star: number = word.indexOf('*');
    const head: string = star > 0 ? word.slice(0, star) : '';
    if (head && !/\d/.test(head)) kept.push(head);
    break;
  }
  const last: string | undefined = kept[kept.length - 1];
  const hasLocationTail: boolean =
    kept.length >= MIN_WORDS_FOR_LOCATION_TAIL && last !== undefined && LOCATION_STATES.has(last);
  return (hasLocationTail ? kept.slice(0, -2) : kept).join(' ');
}

/**
 * A short, useful rule keyword from one transaction's description (PF-929): the name without the
 * store number, reference code or location, so "TACO BELL 041246 ROSWELL GA" gives "TACO BELL".
 * Never contains a comma. When trimming would leave under 3 characters the whole description is
 * used, so a description that is mostly digits still gives a keyword.
 */
export function trimmedKeyword(description: string): string {
  const whole: string = singleKeyword(description).trim();
  const trimmed: string = trimToName(description);
  return trimmed.length >= MIN_KEYWORD_LENGTH ? trimmed : whole;
}

/**
 * A rule keyword from several descriptions (PF-930): the longest run of whole words that every
 * description contains (compared ignoring case, in the first description's casing), trimmed like
 * {@link trimmedKeyword}. Empty when nothing useful is shared. One description gives its trimmed
 * keyword. Never contains a comma.
 */
export function sharedKeyword(descriptions: string[]): string {
  if (descriptions.length === 0) return '';
  if (descriptions.length === 1) return trimmedKeyword(descriptions[0]);

  const first: string[] = words(descriptions[0]);
  const others: string[][] = descriptions
    .slice(1)
    .map((description: string): string[] => words(description).map((w: string) => w.toLowerCase()));
  const containsRun = (run: string[], list: string[]): boolean => {
    const wanted: string = run.map((w: string): string => w.toLowerCase()).join(' ');
    for (let from = 0; from + run.length <= list.length; from++) {
      if (list.slice(from, from + run.length).join(' ') === wanted) return true;
    }
    return false;
  };

  let best = '';
  for (let length = first.length; length >= 1; length--) {
    for (let from = 0; from + length <= first.length; from++) {
      const run: string[] = first.slice(from, from + length);
      const text: string = run.join(' ');
      if (text.length > best.length && others.every((list) => containsRun(run, list))) {
        best = text;
      }
    }
  }

  const keyword: string = trimToName(best);
  return keyword.length >= MIN_KEYWORD_LENGTH ? keyword : '';
}
