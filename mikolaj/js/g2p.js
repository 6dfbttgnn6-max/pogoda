// Zamiana polskiego tekstu na głoski (IPA w konwencji espeak-ng używanej przez modele Piper).
// Własna implementacja, bo fonetyzator WASM gubi polskie znaki diakrytyczne.

const VOWELS = new Set(['a', 'ɛ', 'i', 'ɔ', 'u', 'ɨ', 'ɔ̃', 'ɛ̃']);
const DEVOICE = { b: 'p', d: 't', ɡ: 'k', z: 's', ʒ: 'ʃ', ʑ: 'ɕ', v: 'f', dz: 'ts', dʒ: 'tʃ', dʑ: 'tɕ' };
const VOICE = Object.fromEntries(Object.entries(DEVOICE).map(([a, b]) => [b, a]));
VOICE.x = 'x'; // "ch" nie udźwięcznia się w tej uproszczonej wersji
const OBSTRUENT = new Set([...Object.keys(DEVOICE), ...Object.values(DEVOICE), 'x']);
const LABIAL_VELAR = new Set(['p', 'm', 'f', 'v', 'k', 'ɡ', 'x']);

// Słowa bez akcentu (klitki) – łączą się z sąsiednim wyrazem.
const UNSTRESSED = new Set(['w', 'z', 'ze', 'we', 'od', 'do', 'na', 'za', 'po', 'pod', 'przed', 'nad', 'i', 'a',
  'o', 'u', 'że', 'się', 'by', 'bo', 'ku', 'oraz', 'lub', 'czy', 'mi', 'ci', 'go', 'mu', 'cię', 'ją', 'je']);

const isVowelLetter = (c) => !!c && 'aąeęioóuy'.includes(c);

/** Litery jednego wyrazu (małe) -> lista głosek. */
function lettersToPhones(w) {
  const out = [];
  let i = 0;
  const next = (k = 1) => w[i + k] || '';
  while (i < w.length) {
    const c = w[i];
    const c2 = w.slice(i, i + 2);
    const c3 = w.slice(i, i + 3);
    // zmiękczenia z "i": si, zi, ci, ni, dzi
    if (c3 === 'dzi') { out.push('dʑ'); i += isVowelLetter(w[i + 3] || '') ? 3 : 2; continue; }
    if (c2 === 'si' || c2 === 'zi' || c2 === 'ci' || c2 === 'ni') {
      const map = { si: 'ɕ', zi: 'ʑ', ci: 'tɕ', ni: 'ɲ' };
      out.push(map[c2]);
      if (isVowelLetter(w[i + 2] || '')) {
        if (c2 === 'ni' && 'eę'.includes(w[i + 2])) out.push('ʲ'); // konwencja espeak: ɲʲɛ
        i += 2;
      } else i += 1; // "i" zostaje samogłoską: zima -> ʑima
      continue;
    }
    if (c2 === 'dż') { out.push('dʒ'); i += 2; continue; }
    if (c2 === 'dź') { out.push('dʑ'); i += 2; continue; }
    if (c2 === 'dz') { out.push('dz'); i += 2; continue; }
    if (c2 === 'cz') { out.push('tʃ'); i += 2; continue; }
    if (c2 === 'sz') { out.push('ʃ'); i += 2; continue; }
    if (c2 === 'rz') { out.push('ʒ'); i += 2; continue; }
    if (c2 === 'ch') { out.push('x'); i += 2; continue; }
    if (c2 === 'qu') { out.push('k', 'v'); i += 2; continue; }
    if (c2 === 'au' && i + 2 <= w.length) { out.push('a', 'w'); i += 2; continue; }
    switch (c) {
      case 'a': out.push('a'); break;
      case 'ą': out.push('ɔ̃'); break;
      case 'e': out.push('ɛ'); break;
      case 'ę': out.push('ɛ̃'); break;
      case 'o': out.push('ɔ'); break;
      case 'ó': case 'u': out.push('u'); break;
      case 'y': out.push('ɨ'); break;
      case 'i': {
        // spółgłoska + i + samogłoska -> zmiękczenie (pies -> pʲɛs, Julia -> julja)
        const prev = out[out.length - 1];
        if (prev && !VOWELS.has(prev) && prev !== 'j' && isVowelLetter(next())) {
          out.push(LABIAL_VELAR.has(prev) ? 'ʲ' : 'j');
        } else {
          if (prev === 'k' || prev === 'ɡ') out.push('ʲ'); // kiedy, drogi -> kʲi, ɡʲi
          out.push('i');
        }
        break;
      }
      case 'b': out.push('b'); break;
      case 'c': out.push('ts'); break;
      case 'ć': out.push('tɕ'); break;
      case 'd': out.push('d'); break;
      case 'f': out.push('f'); break;
      case 'g': out.push('ɡ'); break;
      case 'h': out.push('x'); break;
      case 'j': out.push('j'); break;
      case 'k': out.push('k'); break;
      case 'l': out.push('l'); break;
      case 'ł': out.push('w'); break;
      case 'm': out.push('m'); break;
      case 'n': out.push('n'); break;
      case 'ń': out.push('ɲ'); break;
      case 'p': out.push('p'); break;
      case 'r': out.push('r'); break;
      case 's': out.push('s'); break;
      case 'ś': out.push('ɕ'); break;
      case 't': out.push('t'); break;
      case 'w': case 'v': out.push('v'); break;
      case 'x': out.push('k', 's'); break;
      case 'z': out.push('z'); break;
      case 'ź': out.push('ʑ'); break;
      case 'ż': out.push('ʒ'); break;
      case 'q': out.push('k'); break;
      default: break; // inne znaki pomijamy
    }
    i += 1;
  }
  return out;
}

/** Nosówki: wymowa zależna od następnej głoski. */
function nasals(ph) {
  const res = [];
  for (let i = 0; i < ph.length; i++) {
    const p = ph[i];
    if (p !== 'ɔ̃' && p !== 'ɛ̃') { res.push(p); continue; }
    const base = p === 'ɔ̃' ? 'ɔ' : 'ɛ';
    let n = ph[i + 1];
    if (n === 'ʲ') n = ph[i + 2];
    if (n === undefined) { res.push(p === 'ɛ̃' ? 'ɛ' : 'ɔ̃'); continue; } // się -> ɕɛ, są -> sɔ̃
    if (['p', 'b'].includes(n)) res.push(base, 'm');
    else if (['t', 'd', 'ts', 'dz', 'tʃ', 'dʒ'].includes(n)) res.push(base, 'n');
    else if (['tɕ', 'dʑ'].includes(n)) res.push(base, 'ɲ');
    else if (['k', 'ɡ'].includes(n)) res.push(base, 'ŋ');
    else if (['l', 'w'].includes(n)) res.push(base);
    else res.push(p);
  }
  return res;
}

/** Ubezdźwięcznienie i udźwięcznienie w zbitkach oraz na końcu wyrazu. */
function voicing(ph, finalDevoice = true) {
  const res = ph.slice();
  // indeksy pomijające znak zmiękczenia
  const idx = res.map((p, i) => i).filter((i) => res[i] !== 'ʲ');
  // koniec wyrazu: cała końcowa grupa spółgłosek bezdźwięczna
  if (finalDevoice) {
    for (let k = idx.length - 1; k >= 0; k--) {
      const p = res[idx[k]];
      if (!OBSTRUENT.has(p)) break;
      if (DEVOICE[p]) res[idx[k]] = DEVOICE[p];
    }
  }
  // od prawej do lewej: grupa przejmuje dźwięczność ostatniej głoski
  for (let k = idx.length - 2; k >= 0; k--) {
    const cur = res[idx[k]];
    const nxt = res[idx[k + 1]];
    if (!OBSTRUENT.has(cur) || !OBSTRUENT.has(nxt)) continue;
    // "w" i "rz" po bezdźwięcznej nie udźwięczniają (świat, krzyk, twój)
    if (nxt === 'v' || nxt === 'ʒ') {
      if (cur in VOICE) res[idx[k + 1]] = DEVOICE[nxt]; // cur bezdźwięczna
      continue;
    }
    const nxtVoiced = !!DEVOICE[nxt];
    if (nxtVoiced && VOICE[cur] && cur !== 'x') res[idx[k]] = VOICE[cur];
    if (!nxtVoiced && DEVOICE[cur]) res[idx[k]] = DEVOICE[cur];
  }
  return res;
}

function addStress(ph, word) {
  const vIdx = ph.map((p, i) => (VOWELS.has(p) || p === 'ɛ' ? i : -1)).filter((i) => i >= 0);
  if (!vIdx.length) return ph;
  if (UNSTRESSED.has(word)) return ph;
  let target = vIdx.length >= 2 ? vIdx[vIdx.length - 2] : vIdx[0];
  // -śmy, -ście (zrobiliśmy) oraz -yka/-ika (matematyka): akcent na trzecią od końca
  if (vIdx.length >= 3 && (/(śmy|ście)$/.test(word) || (vIdx.length >= 4 && /[iy]k[aię]$/.test(word)))) {
    target = vIdx[vIdx.length - 3];
  }
  const res = ph.slice();
  res.splice(target, 0, 'ˈ');
  if (vIdx.length >= 4 && target !== vIdx[0]) res.splice(vIdx[0], 0, 'ˌ');
  return res;
}

// --- liczby ---
const UNITS = ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć',
  'dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście',
  'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
const TENS = ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt',
  'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
const HUNDREDS = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset',
  'osiemset', 'dziewięćset'];

export function numberToWords(n) {
  n = Math.floor(Math.abs(n));
  if (n < 20) return UNITS[n];
  if (n < 100) return [TENS[Math.floor(n / 10)], n % 10 ? UNITS[n % 10] : ''].filter(Boolean).join(' ');
  if (n < 1000) return [HUNDREDS[Math.floor(n / 100)], n % 100 ? numberToWords(n % 100) : ''].filter(Boolean).join(' ');
  if (n < 1000000) {
    const t = Math.floor(n / 1000);
    const r = n % 1000;
    let tw;
    if (t === 1) tw = 'tysiąc';
    else {
      const last = t % 10, last2 = t % 100;
      const form = last >= 2 && last <= 4 && !(last2 >= 12 && last2 <= 14) ? 'tysiące' : 'tysięcy';
      tw = numberToWords(t) + ' ' + form;
    }
    return [tw, r ? numberToWords(r) : ''].filter(Boolean).join(' ');
  }
  return String(n).split('').map((d) => UNITS[+d]).join(' ');
}

/** Czyści tekst do czytania: liczby słownie, emoji i dziwne znaki out. */
export function normalizeText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/(\d+)\s*zł\b/gi, (m, d) => numberToWords(+d) + ' złotych')
    .replace(/\d+/g, (d) => ' ' + numberToWords(+d) + ' ')
    .replace(/[„”“"«»]/g, '')
    .replace(/[–—]/g, ', ')
    .replace(/[…]/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/[^\p{L}\s.,!?;:'\-]/gu, ' ')
    .replace(/\s*\n\s*/g, '. ')
    .replace(/([.,!?;:])(?=\S)/g, '$1 ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/([.!?])[.,]+/g, '$1')
    .replace(/^[\s.,]+/, '')
    .trim();
}

/** Tekst (jedno lub kilka zdań) -> ciąg IPA zgodny z espeak. */
export function textToIPA(text) {
  const norm = normalizeText(text).toLocaleLowerCase('pl-PL');
  const tokens = norm.match(/[\p{L}'\-]+|[.,!?;:]/gu) || [];
  const words = [];
  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];
    if (/^[.,!?;:]$/.test(tok)) { words.push({ punct: tok }); continue; }
    const w = tok.replace(/['\-]/g, '');
    if (!w) continue;
    words.push({ w, ph: nasals(lettersToPhones(w)) });
  }
  // przyimki jednospółgłoskowe "w", "z" – dźwięczność zależna od następnego wyrazu
  for (let k = 0; k < words.length; k++) {
    const cur = words[k];
    if (!cur.w || !(cur.w === 'w' || cur.w === 'z')) continue;
    const nx = words[k + 1];
    const first = nx && nx.ph ? nx.ph.find((p) => p !== 'ʲ') : undefined;
    const voiceless = first && OBSTRUENT.has(first) && !DEVOICE[first];
    cur.ph = [cur.w === 'w' ? (voiceless ? 'f' : 'v') : (voiceless ? 's' : 'z')];
    cur.clitic = true;
  }
  let out = '';
  for (let k = 0; k < words.length; k++) {
    const cur = words[k];
    if (cur.punct) { out = out.replace(/ $/, '') + cur.punct + ' '; continue; }
    let ph = cur.clitic ? cur.ph : voicing(cur.ph);
    ph = cur.clitic ? ph : addStress(ph, cur.w);
    if (cur.w === 'ho') ph = ['x', 'ˈ', 'ɔ', 'ː']; // śmiech Mikołaja: przeciągnięte "ho
    out += ph.join('') + (cur.clitic ? '' : ' ');
  }
  return out.trim();
}

/** IPA -> identyfikatory dla modelu Piper (BOS, pad między głoskami, EOS). */
export function ipaToIds(ipa, idMap) {
  const ids = [...idMap['^'], ...idMap['_']];
  for (const ch of Array.from(ipa.normalize('NFD'))) {
    const id = idMap[ch];
    if (!id) continue;
    ids.push(...id, ...idMap['_']);
  }
  ids.push(...idMap['$']);
  return ids;
}

/** Dzieli tekst na zdania (do napisów i syntezy porcjami). */
export function splitSentences(text) {
  const norm = normalizeText(text);
  const parts = norm.match(/[^.!?]+[.!?]*/g) || [];
  const res = [];
  for (let p of parts) {
    p = p.trim();
    if (!p) continue;
    // bardzo długie zdania dzielimy po przecinkach (model lepiej brzmi na krótszych porcjach)
    if (p.split(' ').length > 28) {
      const chunks = p.split(/,\s*/);
      let buf = '';
      for (const ch of chunks) {
        if ((buf + ' ' + ch).split(' ').length > 22 && buf) { res.push(buf.trim() + ','); buf = ch; }
        else buf = buf ? buf + ', ' + ch : ch;
      }
      if (buf) res.push(buf.trim());
    } else res.push(p);
  }
  return res;
}
