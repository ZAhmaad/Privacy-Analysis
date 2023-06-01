interface LcsStringMatch {
  index1: number;
  index2: number;
  length: number;
}

function lcsString(str1: string, str2: string): LcsStringMatch {
  const M = str1.length;
  const N = str2.length;
  let index1 = -1;
  let index2 = -1;
  let length = 0;
  for (let i = 0, l = 0; i < M; i += l > 0 ? l : 1) {
    for (let j = 0; i + l < M && j < N; j += 1) {
      if (str1[i + l] === str2[j]) {
        l += 1;
        if (l > length) {
          index1 = i;
          index2 = j - l + 1;
          length = l;
        }
      } else {
        l = 0;
      }
    }
  }
  return { index1, index2, length };
}

interface Token {
  value: string;
}

function stringFromTokenSequence(seq: Token[]): string {
  return seq.map((token) => token.value).join("");
}

function minimalTokenSequencesFromStrings(
  str1: string,
  str2: string
): { seq1: Token[]; seq2: Token[] } {
  const { index1, index2, length } = lcsString(str1, str2);
  if (length > 1) {
    const { seq1: l1, seq2: l2 } = minimalTokenSequencesFromStrings(
      str1.substring(0, index1),
      str2.substring(0, index2)
    );
    const { seq1: r1, seq2: r2 } = minimalTokenSequencesFromStrings(
      str1.substring(index1 + length),
      str2.substring(index2 + length)
    );
    const token = { value: str1.substring(index1, index1 + length) };
    return {
      seq1: [...l1, token, ...r1],
      seq2: [...l2, token, ...r2],
    };
  } else {
    return {
      seq1: [...str1].map((chr) => ({ value: chr })),
      seq2: [...str2].map((chr) => ({ value: chr })),
    };
  }
}

interface LcsTokenSequenceMatch {
  index1: number;
  index2: number;
}

function lcsTokenSequence(
  seq1: Token[],
  seq2: Token[]
): LcsTokenSequenceMatch[] {
  const M = seq1.length;
  const N = seq2.length;
  const C = new Array(M + 1);
  for (let i = 0; i < C.length; i++) {
    C[i] = new Array(N + 1);
  }

  for (let i = 0; i <= M; ++i) {
    for (let j = 0; j <= N; ++j) {
      if (i === 0 || j === 0) {
        C[i][j] = 0;
      } else if (seq1[i - 1].value === seq2[j - 1].value) {
        C[i][j] = C[i - 1][j - 1] + 1;
      } else {
        const c1 = C[i - 1][j];
        const c2 = C[i][j - 1];
        C[i][j] = c1 > c2 ? c1 : c2;
      }
    }
  }

  const matches: LcsTokenSequenceMatch[] = [];
  for (let i = M, j = N; C[i][j] !== 0; ) {
    if (seq1[i - 1].value === seq2[j - 1].value) {
      matches.unshift({ index1: i - 1, index2: j - 1 });
      i -= 1;
      j -= 1;
    } else if (C[i][j - 1] > C[i - 1][j]) {
      j -= 1;
    } else {
      i -= 1;
    }
  }
  return matches;
}

export {
  LcsStringMatch,
  lcsString,
  Token,
  stringFromTokenSequence,
  minimalTokenSequencesFromStrings,
  LcsTokenSequenceMatch,
  lcsTokenSequence,
};
