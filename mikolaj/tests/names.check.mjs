// Uruchom: node mikolaj/tests/names.check.mjs
import { vocative } from '../js/names.js';

const cases = [
  ['Zosia', 'f', 'Zosiu'], ['Kasia', 'f', 'Kasiu'], ['Hania', 'f', 'Haniu'], ['Gabrysia', 'f', 'Gabrysiu'],
  ['Anna', 'f', 'Anno'], ['Marta', 'f', 'Marto'], ['Julia', 'f', 'Julio'], ['Natalia', 'f', 'Natalio'],
  ['Wiktoria', 'f', 'Wiktorio'], ['Maja', 'f', 'Maju'], ['Ola', 'f', 'Olu'], ['Lena', 'f', 'Leno'],
  ['Ewa', 'f', 'Ewo'], ['Zuzanna', 'f', 'Zuzanno'], ['Laura', 'f', 'Lauro'], ['Alicja', 'f', 'Alicjo'],
  ['Nikola', 'f', 'Nikolo'], ['Agata', 'f', 'Agato'], ['Klara', 'f', 'Klaro'], ['Michalina', 'f', 'Michalino'],
  ['Jan', 'm', 'Janie'], ['Adam', 'm', 'Adamie'], ['Piotr', 'm', 'Piotrze'], ['Paweł', 'm', 'Pawle'],
  ['Michał', 'm', 'Michale'], ['Kacper', 'm', 'Kacprze'], ['Jakub', 'm', 'Jakubie'], ['Antoni', 'm', 'Antoni'],
  ['Kuba', 'm', 'Kubo'], ['Staś', 'm', 'Stasiu'], ['Kubuś', 'm', 'Kubusiu'], ['Franek', 'm', 'Franku'],
  ['Wojtek', 'm', 'Wojtku'], ['Bartek', 'm', 'Bartku'], ['Igor', 'm', 'Igorze'], ['Aleksander', 'm', 'Aleksandrze'],
  ['Szymon', 'm', 'Szymonie'], ['Filip', 'm', 'Filipie'], ['Mikołaj', 'm', 'Mikołaju'], ['Leon', 'm', 'Leonie'],
  ['Oskar', 'm', 'Oskarze'], ['Wiktor', 'm', 'Wiktorze'], ['Marcel', 'm', 'Marcelu'], ['Karol', 'm', 'Karolu'],
  ['Maciej', 'm', 'Macieju'], ['Nikodem', 'm', 'Nikodemie'], ['Ignacy', 'm', 'Ignacy'], ['Łukasz', 'm', 'Łukaszu'],
  ['Mateusz', 'm', 'Mateuszu'], ['Krzysztof', 'm', 'Krzysztofie'], ['Dominik', 'm', 'Dominiku'], ['Patryk', 'm', 'Patryku'],
  ['Hubert', 'm', 'Hubercie'], ['Dawid', 'm', 'Dawidzie'], ['Maks', 'm', 'Maksie'], ['Tymon', 'm', 'Tymonie'],
  ['Stanisław', 'm', 'Stanisławie'], ['Tomek', 'm', 'Tomku'], ['Marek', 'm', 'Marku'], ['Jacek', 'm', 'Jacku'],
  ['Olek', 'm', 'Olku'], ['Maciek', 'm', 'Maćku'], ['Gustaw', 'm', 'Gustawie'], ['Brajan', 'm', 'Brajanie'],
  ['Natan', 'm', 'Natanie'], ['Tymoteusz', 'm', 'Tymoteuszu'], ['Bartosz', 'm', 'Bartoszu'], ['Ksawery', 'm', 'Ksawery'],
  ['Henryk', 'm', 'Henryku'], ['Robert', 'm', 'Robercie'], ['Alan', 'm', 'Alanie'], ['Fabian', 'm', 'Fabianie'],
  ['Anna Maria', 'f', 'Anno Mario'], ['jan', 'm', 'Janie'],
];

let fail = 0;
for (const [n, g, exp] of cases) {
  const got = vocative(n, g);
  if (got !== exp) { fail++; console.log(`BŁĄD: ${n} (${g}) -> ${got}, oczekiwano ${exp}`); }
}
console.log(`${cases.length - fail}/${cases.length} poprawnych`);
process.exit(fail ? 1 : 0);
