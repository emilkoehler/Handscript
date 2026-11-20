// Zeichen, die in der Schriftprobe abgefragt werden, in sinnvoller Reihenfolge.
export interface CharGroup {
  name: string;
  chars: string[];
}

const split = (s: string) => [...s];

export const CHAR_GROUPS: CharGroup[] = [
  { name: 'Kleinbuchstaben', chars: split('abcdefghijklmnopqrstuvwxyzäöüß') },
  { name: 'Großbuchstaben', chars: split('ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ') },
  { name: 'Ziffern', chars: split('0123456789') },
  { name: 'Satzzeichen', chars: split('.,;:!?-–\'"„“()/&@€%+=*#§') },
];

export const ALL_CHARS: string[] = CHAR_GROUPS.flatMap((g) => g.chars);

/** Lesbarer Name für Zeichen, die man schlecht erkennt. */
export function charLabel(ch: string): string {
  const names: Record<string, string> = {
    '.': 'Punkt',
    ',': 'Komma',
    ';': 'Semikolon',
    ':': 'Doppelpunkt',
    '-': 'Bindestrich',
    '–': 'Gedankenstrich',
    "'": 'Apostroph',
    '"': 'Anführungszeichen',
    '„': 'Anführung unten',
    '“': 'Anführung oben',
  };
  return names[ch] ?? ch;
}
