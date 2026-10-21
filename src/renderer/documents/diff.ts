export interface DiffLine {
  kind: 'same' | 'mine' | 'theirs';
  text: string;
}

const MAX_LINES = 4000;

/** Diferencia por líneas (LCS). Para textos enormes se degrada a «todo cambió» en la zona central. */
export function lineDiff(mine: string, theirs: string): DiffLine[] {
  const a = mine.split('\n');
  const b = theirs.split('\n');
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const out: DiffLine[] = a.slice(0, start).map((text) => ({ kind: 'same', text }));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  if (midA.length > MAX_LINES || midB.length > MAX_LINES) {
    out.push(...midA.map((text): DiffLine => ({ kind: 'mine', text })));
    out.push(...midB.map((text): DiffLine => ({ kind: 'theirs', text })));
  } else {
    const n = midA.length;
    const m = midB.length;
    const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i]![j] =
          midA[i] === midB[j]
            ? table[i + 1]![j + 1]! + 1
            : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        out.push({ kind: 'same', text: midA[i]! });
        i++;
        j++;
      } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
        out.push({ kind: 'mine', text: midA[i++]! });
      } else {
        out.push({ kind: 'theirs', text: midB[j++]! });
      }
    }
    while (i < n) out.push({ kind: 'mine', text: midA[i++]! });
    while (j < m) out.push({ kind: 'theirs', text: midB[j++]! });
  }
  out.push(...a.slice(endA).map((text): DiffLine => ({ kind: 'same', text })));
  return out;
}
