// Wołacz polskich imion (np. Zosia -> Zosiu, Jan -> Janie).
// Najpierw słownik wyjątków, potem reguły. Rodzic może poprawić wynik ręcznie.

const EXCEPTIONS = {
  // męskie z ruchomym "e" i inne nieregularne
  'paweł': 'Pawle', 'kacper': 'Kacprze', 'aleksander': 'Aleksandrze', 'olek': 'Olku',
  'maciek': 'Maćku', 'józek': 'Józku', 'lew': 'Lwie', 'piotr': 'Piotrze', 'alex': 'Aleksie',
  'aleks': 'Aleksie', 'max': 'Maksie', 'felix': 'Feliksie', 'marcel': 'Marcelu',
  'tomasz': 'Tomaszu', 'leszek': 'Leszku', 'antek': 'Antku', 'wicek': 'Wicku',
  'jędrek': 'Jędrku', 'kuba': 'Kubo', 'bruno': 'Bruno', 'hugo': 'Hugo', 'mario': 'Mario',
  'leo': 'Leo', 'nikola': 'Nikolo', 'luka': 'Luko', 'noe': 'Noe', 'jerzy': 'Jerzy',
  'ignacy': 'Ignacy', 'antoni': 'Antoni', 'ksawery': 'Ksawery', 'jeremi': 'Jeremi',
  'tymoteusz': 'Tymoteuszu', 'bartłomiej': 'Bartłomieju', 'cyprian': 'Cyprianie',
  'ryszard': 'Ryszardzie', 'bogdan': 'Bogdanie', 'witold': 'Witoldzie', 'konrad': 'Konradzie',
  'dawid': 'Dawidzie', 'fryderyk': 'Fryderyku', 'emil': 'Emilu', 'kamil': 'Kamilu',
  'karol': 'Karolu', 'daniel': 'Danielu', 'michał': 'Michale', 'gaweł': 'Gawle',
  'staś': 'Stasiu', 'jaś': 'Jasiu', 'adaś': 'Adasiu', 'kubuś': 'Kubusiu', 'franio': 'Franiu',
  'stasio': 'Stasiu', 'jasio': 'Jasiu', 'kazio': 'Kaziu', 'tadzio': 'Tadziu', 'józio': 'Józiu',
  // żeńskie
  'ola': 'Olu', 'ala': 'Alu', 'ela': 'Elu', 'ula': 'Ulu', 'iza': 'Izo', 'karola': 'Karolo',
  'nela': 'Nelu', 'lila': 'Lilu', 'mila': 'Milu', 'gabi': 'Gabi', 'nikol': 'Nikol',
  'miriam': 'Miriam', 'noemi': 'Noemi', 'karin': 'Karin', 'dagmar': 'Dagmar',
  'kasieńka': 'Kasieńko', 'zosieńka': 'Zosieńko', 'maja': 'Maju', 'kaja': 'Kaju',
  'aleksandra': 'Aleksandro', 'amelia': 'Amelio', 'oliwia': 'Oliwio', 'julia': 'Julio',
  'maria': 'Mario', 'lena': 'Leno', 'hanna': 'Hanno', 'zuzanna': 'Zuzanno', 'nadia': 'Nadio',
  'antonina': 'Antonino', 'pola': 'Polu', 'tola': 'Tolu', 'lola': 'Lolu', 'mela': 'Melu',
};

function cap(s) {
  return s ? s.charAt(0).toLocaleUpperCase('pl-PL') + s.slice(1) : s;
}

function femaleVocative(n) {
  // Zosia, Kasia, Hania, Basia, Tosia, Gabrysia, Kazia, Dzidzia -> -iu
  if (/(si|zi|ci|ni|dzi)a$/.test(n)) return n.slice(0, -1) + 'u';
  // Maja, Kaja -> -ju
  if (/[aeiouyóąę]ja$/.test(n)) return n.slice(0, -1) + 'u';
  // Julia, Natalia, Wiktoria, Emilia -> -io ; pozostałe -a -> -o (Anna -> Anno, Marta -> Marto)
  if (n.endsWith('a')) return n.slice(0, -1) + 'o';
  return n; // imiona nieodmienne lub obce
}

function maleVocative(n) {
  if (/[iy]$/.test(n)) return n;                         // Antoni, Ignacy
  if (/[eo]$/.test(n) && /(si|zi|ci|ni|dzi)o$/.test(n)) return n.slice(0, -1) + 'u'; // Stasio
  if (/[aeoóuę]$/.test(n)) return n.endsWith('a') ? n.slice(0, -1) + 'o' : n; // Kuba -> Kubo, Bruno
  const soft = { 'ś': 'siu', 'ź': 'ziu', 'ć': 'ciu', 'ń': 'niu' };
  const last = n.slice(-1);
  if (soft[last]) return n.slice(0, -1) + soft[last];    // Staś -> Stasiu
  if (/[^aeiouyóąę]ek$/.test(n)) return n.slice(0, -2) + 'ku'; // Franek -> Franku
  if (/(k|g|ch|h|j|l|sz|cz|rz|ż|dż|c|dz)$/.test(n)) return n + 'u'; // Dominik, Maciej, Łukasz
  if (n.endsWith('ł')) return n.slice(0, -1) + 'le';     // Michał -> Michale
  if (n.endsWith('r')) return n + 'ze';                  // Igor -> Igorze
  if (n.endsWith('st')) return n.slice(0, -2) + 'ście';  // August -> Auguście
  if (n.endsWith('t')) return n.slice(0, -1) + 'cie';    // Hubert -> Hubercie
  if (n.endsWith('d')) return n + 'zie';                 // Dawid -> Dawidzie
  if (n.endsWith('x')) return n.slice(0, -1) + 'ksie';
  if (/[nmpbfwsz]$/.test(n)) return n + 'ie';            // Jan -> Janie, Adam -> Adamie
  return n;
}

/** Wołacz jednego imienia. gender: 'm' | 'f'. */
export function vocativeOne(name, gender) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const lower = raw.toLocaleLowerCase('pl-PL');
  if (EXCEPTIONS[lower]) return EXCEPTIONS[lower];
  const v = gender === 'f' ? femaleVocative(lower) : maleVocative(lower);
  return cap(v);
}

/** Wołacz, obsługuje imiona złożone ("Anna Maria", "Jan-Paweł"). */
export function vocative(name, gender) {
  return String(name || '')
    .trim()
    .split(/(\s+|-)/)
    .map((part) => (/^(\s+|-)$/.test(part) || !part ? part : vocativeOne(part, gender)))
    .join('');
}

/** Zgadywanie płci po imieniu, tylko jako podpowiedź (rodzic i tak wybiera). */
export function guessGender(name) {
  const n = String(name || '').trim().toLocaleLowerCase('pl-PL').split(/\s+/)[0];
  if (!n) return null;
  const maleA = ['kuba', 'barnaba', 'kosma', 'bonawentura', 'jarema', 'nikola', 'luka'];
  if (maleA.includes(n)) return 'm';
  return n.endsWith('a') ? 'f' : 'm';
}
