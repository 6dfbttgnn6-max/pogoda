// Tekst, który mówi Mikołaj. Każdy fragment ma kilka wersji o tym samym sensie,
// więc kolejne filmy różnią się trochę, ale przekaz jest zawsze ten sam.
import { splitSentences } from './g2p.js';

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];

/** Prosty, powtarzalny generator losowy (ten sam seed = ten sam tekst). */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * Buduje scenariusz filmu.
 * @param {{vocative:string, gender:'m'|'f', letter:string, seed?:number}} o
 * @returns {Array<{section:string, text:string, pauseAfter:number}>}
 */
export function buildScript({ vocative, gender, letter, seed = Date.now() }) {
  const rnd = seeded(seed);
  const f = gender === 'f';
  const g = (m, w) => (f ? w : m);
  const drogi = g('drogi', 'droga');

  const greeting = [
    `Ho, ho, ho! Witaj, ${drogi} ${vocative}!`,
    pick([
      'Pozdrawiam Cię serdecznie z mojej zaśnieżonej pracowni na dalekiej Północy.',
      'Mówi do Ciebie Święty Mikołaj, prosto z mojej ciepłej pracowni na Biegunie Północnym.',
      'Tu Święty Mikołaj. Pozdrawiam Cię gorąco z krainy wiecznego śniegu.',
    ], rnd),
    pick([
      'Mam tutaj list od Ciebie. Usiądź wygodnie, zaraz go przeczytam.',
      'Moje elfy przyniosły mi właśnie list od Ciebie. Posłuchaj, zaraz go przeczytam.',
      'Trzymam w dłoniach list od Ciebie. Założę okulary i zaraz go przeczytam.',
    ], rnd),
  ];

  const thanks = pick([
    'Dziękuję Ci za ten piękny list. Przeczytałem go z wielką radością.',
    'Jaki wspaniały list! Bardzo Ci za niego dziękuję.',
    'Ho, ho! To był naprawdę piękny list. Serdecznie Ci dziękuję.',
  ], rnd);

  const good = pick([
    `Wiem, że przez cały rok ${g('byłeś bardzo grzecznym chłopcem', 'byłaś bardzo grzeczną dziewczynką')}. Opowiedzieli mi o tym Twoi bliscy, a i ja sam widziałem to nie raz, kiedy zaglądałem przez okno.`,
    `Twoi bliscy powiedzieli mi, że przez cały rok ${g('byłeś bardzo grzeczny', 'byłaś bardzo grzeczna')}. Ja też to widziałem, gdy po cichutku zaglądałem przez okno.`,
    `Z tego, co opowiedzieli mi Twoi bliscy, i z tego, co sam widziałem przez okno, wiem, że przez cały rok ${g('byłeś bardzo grzeczny', 'byłaś bardzo grzeczna')}.`,
  ], rnd);

  const sorry = pick([
    'Muszę Ci jednak coś powiedzieć. W tym roku nie dam rady odwiedzić Cię osobiście. Na całym świecie czeka na mnie tak wiele dzieci, że moje renifery ledwo nadążają.',
    'Mam też dla Ciebie pewną wiadomość. Bardzo przepraszam, ale tym razem nie przyjadę do Ciebie osobiście. Mam do odwiedzenia mnóstwo dzieci na całym świecie, a noc wigilijna jest taka krótka.',
    'Wybacz mi, proszę, że w tym roku nie zapukam do Twoich drzwi. Muszę odwiedzić tyle dzieci na całym świecie, że nawet moje najszybsze renifery ledwo dają radę.',
  ], rnd);

  const gifts = pick([
    `Ale nie martw się! Prezenty, o które ${g('prosiłeś', 'prosiłaś')} w liście, będą na Ciebie czekały pod choinką w wigilijny wieczór.`,
    `Ale nic się nie martw. Moje elfy właśnie pakują prezenty, o które ${g('prosiłeś', 'prosiłaś')} w swoim liście. W Wigilię znajdziesz je pod choinką.`,
    `Obiecuję Ci jednak, że w Wigilię pod Twoją choinką pojawią się prezenty, o których ${g('pisałeś', 'pisałaś')} w liście. Elfy już je starannie pakują.`,
  ], rnd);

  const advice = pick([
    `Pamiętaj, ${g('bądź grzeczny', 'bądź grzeczna')} i pilnie się ucz przez cały przyszły rok. Ja i moje elfy wciąż na Ciebie patrzymy.`,
    `Proszę Cię, ${g('bądź grzeczny', 'bądź grzeczna')} i dobrze się ucz także w przyszłym roku. Pamiętaj, że cały czas Cię obserwuję.`,
    `A w przyszłym roku ${g('bądź tak samo grzeczny', 'bądź tak samo grzeczna')} i ucz się pilnie. Będę na Ciebie patrzył z mojej pracowni.`,
  ], rnd);

  const ending = 'Ho, ho, ho! Wesołych Świąt Bożego Narodzenia!';

  const out = [];
  const push = (section, text, pauseAfter = 0.45) => {
    for (const s of splitSentences(text)) out.push({ section, text: s, pauseAfter });
    if (out.length) out[out.length - 1].pauseAfter = pauseAfter;
  };
  greeting.forEach((t, i) => push('greeting', t, i === greeting.length - 1 ? 1.3 : 0.6));
  push('letter', letter, 1.4);
  push('reply', thanks, 0.8);
  push('reply', good, 0.8);
  push('reply', sorry, 0.8);
  push('gifts', gifts, 0.8);
  push('reply', advice, 0.9);
  push('ending', ending, 0);
  // krótsze pauzy wewnątrz listu
  for (const s of out) if (s.section === 'letter' && s.pauseAfter < 1) s.pauseAfter = 0.5;
  return out;
}

export function countWords(text) {
  return (String(text || '').match(/[\p{L}\d]+/gu) || []).length;
}
