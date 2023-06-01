import {
  Token,
  lcsString,
  lcsTokenSequence,
  minimalTokenSequencesFromStrings,
  stringFromTokenSequence,
} from "./lcs";

const FROM_YEAR = 2000;
const FROM_TIMESTAMP = +new Date(FROM_YEAR, 0, 1);
const TO_YEAR = 2050;
const TO_TIMESTAMP = +new Date(TO_YEAR, 0, 1);

function stripUnixTimestamps(str: string): string {
  return [...str.matchAll(/[0-9]+/g)]
    .filter((match) => {
      const matchStr = match[0];
      if (matchStr[0] !== "0") {
        const ts = +matchStr;
        return ts >= FROM_TIMESTAMP && ts < TO_TIMESTAMP;
      }
      return false;
    })
    .map((match) => {
      const start = match.index!;
      const end = start + match[0].length;
      return { start, end };
    })
    .reduce((acc, match) => {
      const offset = str.length - acc.length;
      const stripStart = match.start - offset;
      const stripEnd = match.end - offset;
      return acc.substring(0, stripStart) + acc.substring(stripEnd);
    }, str);
}

function stripISO8601Dates(str: string): string {
  return [...str.matchAll(/[0-9]+-[0-9]{2}-[0-9]+/g)]
    .filter((match) => {
      const matchStr = match[0];
      const parts = matchStr.split("-");
      if (
        parts[0].length === 4 &&
        parts[0][0] !== "0" &&
        parts[1].length === 2 &&
        parts[2].length === 2
      ) {
        const yyyy = +parts[0];
        const mm = +parts[1];
        const dd = +parts[2];
        return (
          yyyy >= FROM_YEAR &&
          yyyy < TO_YEAR &&
          mm >= 1 &&
          mm <= 12 &&
          dd >= 1 &&
          dd <= 31
        );
      }
      return false;
    })
    .map((match) => {
      const start = match.index!;
      let end = -1;
      for (let i = 10; i < 30 && start + i < str.length; ++i) {
        if (!isNaN(+new Date(str.substring(start, start + i + 1)))) {
          end = start + i + 1;
        }
      }
      return end !== -1 ? { start, end } : null;
    })
    .filter(
      (maybeMatch): maybeMatch is { start: number; end: number } =>
        maybeMatch !== null
    )
    .reduce((acc, match) => {
      const offset = str.length - acc.length;
      const stripStart = match.start - offset;
      const stripEnd = match.end - offset;
      return acc.substring(0, stripStart) + acc.substring(stripEnd);
    }, str);
}

function stripTimestamps(str: string): string {
  return stripISO8601Dates(stripUnixTimestamps(str));
}

function stripTokensFromTokenSequence(
  seq: Token[],
  indexes: number[]
): Token[] {
  return seq.filter((_, i) => !indexes.includes(i));
}

function stripRecurrentSubstrings(arg: { str1: string; str2: string }): {
  str1: string;
  str2: string;
} {
  const maxLength = 2;
  const { str1, str2 } = arg;
  let { seq1, seq2 } = minimalTokenSequencesFromStrings(str1, str2);
  for (
    let matches;
    (matches = lcsTokenSequence(seq1, seq2)),
      matches
        .map(({ index1 }) => seq1[index1].value.length)
        .reduce((sum, cur) => sum + cur, 0) > maxLength;
    seq1 = stripTokensFromTokenSequence(
      seq1,
      matches.map(({ index1 }) => index1)
    ),
      seq2 = stripTokensFromTokenSequence(
        seq2,
        matches.map(({ index2 }) => index2)
      )
  ) {}
  return {
    str1: stringFromTokenSequence(seq1),
    str2: stringFromTokenSequence(seq2),
  };
}

function countMatchingCharacters(str1: string, str2: string): number {
  const { index1, index2, length } = lcsString(str1, str2);
  if (length > 0) {
    return (
      length +
      countMatchingCharacters(
        str1.substring(0, index1),
        str2.substring(0, index2)
      ) +
      countMatchingCharacters(
        str1.substring(index1 + length),
        str2.substring(index2 + length)
      )
    );
  } else {
    return 0;
  }
}

function calcSimilarityScore(str1: string, str2: string): number {
  if (str1.length === 0 && str2.length === 0) {
    return 1;
  } else {
    return (
      (2 * countMatchingCharacters(str1, str2)) / (str1.length + str2.length)
    );
  }
}

function areSignificantlyDifferent(str1: string, str2: string): boolean {
  if (str1 === str2) {
    return false;
  } else {
    const scoreThreshold = 0.66;
    const { str1: cleanStr1, str2: cleanStr2 } = stripRecurrentSubstrings({
      str1: stripTimestamps(str1),
      str2: stripTimestamps(str2),
    });
    return calcSimilarityScore(cleanStr1, cleanStr2) < scoreThreshold;
  }
}

export { areSignificantlyDifferent };
