# Pogoda Drogowa

Aplikacja pogodowa dla kierowców w Polsce (PWA): ryzyko **gołoledzi i oblodzenia**, **śnieg**, **deszcz**, **mgła** i **wiatr**, liczone dla Twojej lokalizacji oraz **wzdłuż trasy, na godzinę, o której faktycznie tam będziesz**.

> Nazwa „Pogoda Drogowa” jest robocza. Przed publikacją sprawdź dostępność nazwy i domeny.

## Funkcje

| Widok | Co robi |
|---|---|
| **Teraz** | Ocena warunków w miejscu użytkownika (GPS lub wyszukiwarka): poziom ryzyka, temperatura powietrza i szacowana temperatura nawierzchni, lista zagrożeń, oś 48 h, kolejne dni, ostrzeżenia IMGW dla powiatu. |
| **Trasa** | Trasa A→B (z wariantami), prognoza w punktach co ok. 8–15 km **na przewidywaną godzinę przejazdu**, kolorowanie odcinków na mapie, profil temperatury, lista odcinków z zagrożeniami, ostrzeżenia IMGW na trasie i **najlepsza godzina wyjazdu** w ciągu 12 h. |
| **Mapa** | Mapa ryzyka dla całej Polski (interpolacja z ok. 200 punktów), warstwy: ryzyko / temperatura nawierzchni / śnieg, suwak czasu 0–36 h, powiaty z aktywnymi ostrzeżeniami IMGW. |
| **Alerty** | Zapisane trasy i miejsca z godziną wyjazdu i dniami tygodnia. Powiadomienie przed wyjazdem, gdy ryzyko przekroczy wybrany próg. |

Dodatkowo: motyw jasny/ciemny (domyślnie systemowy), instalacja jako aplikacja (PWA), praca offline na ostatnich danych, układ mobilny z dolnym arkuszem.

## Analiza źródeł danych

| Źródło | Co daje kierowcy | Licencja / koszt | Rola w projekcie |
|---|---|---|---|
| **IMGW-PIB** (`danepubliczne.imgw.pl`) | Oficjalne ostrzeżenia meteorologiczne (np. „Oblodzenie”) przypisane do powiatów (TERYT), pomiary SYNOP | Bezpłatne, wymagane podanie źródła. Brak formalnej specyfikacji API. | **Używane**: ostrzeżenia podnoszą ocenę ryzyka |
| **Open-Meteo** | Prognoza godzinowa (modele ICON-D2/ICON-EU/ECMWF, wybór automatyczny): temperatura, punkt rosy, opad, śnieg, kody WMO marznącego deszczu, temperatura gruntu 0 cm, widoczność, porywy | Darmowe API **tylko do użytku niekomercyjnego**; komercyjnie płatny abonament. Dane CC BY 4.0. | **Używane** (prototyp) |
| **MET Norway** (Locationforecast) | Prognoza punktowa dla Europy | Bezpłatne także komercyjnie (CC BY 4.0), wymagana atrybucja i identyfikujący User-Agent | Kandydat na drugie źródło lub zapas |
| **GDDKiA** (drogowe stacje meteo) | Pomiary z czujników w nawierzchni (temperatura jezdni, temperatura zamarzania) | **Nie znaleziono publicznego API.** Publicznie dostępne są utrudnienia drogowe (Krajowy Punkt Dostępowy). | Największa wartość dla oceny gołoledzi. Dostęp do uzgodnienia z GDDKiA. |
| Tomorrow.io, Meteoblue, DTN | Komercyjne prognozy i indeksy drogowe | Płatne (cen nie weryfikowano) | Opcja na etap komercyjny |

**Mapy i trasy:** OpenFreeMap (kafelki wektorowe OSM), OSRM (routing), Photon (wyszukiwarka). Granice powiatów: OpenStreetMap (ODbL), kontur Polski: Natural Earth.

## Metodologia oceny ryzyka

Darmowe modele **nie prognozują temperatury nawierzchni asfaltu**. Aplikacja używa temperatury gruntu 0 cm z modelu jako przybliżenia, korygowanej o wychładzanie nocą przy bezchmurnym niebie i słabym wietrze. Ocena jest heurystyką i interfejs komunikuje to wprost.

Poziomy: **0 Dobre**, **1 Uwaga**, **2 Trudne**, **3 Niebezpiecznie**. Reguły (`src/risk/engine.ts`):

| Zagrożenie | Warunek | Poziom |
|---|---|---|
| Gołoledź (marznący deszcz) | kod WMO 56/57/66/67 | 3 |
| Gołoledź | deszcz przy nawierzchni ≤ +0,5°C | 3 |
| Oblodzenie mokrej jezdni | deszcz w ostatnich 3 h i nawierzchnia ≤ 0°C | 2 (3 przy ≤ −1°C) |
| Szron | nawierzchnia ≤ 0°C, poniżej punktu rosy, wilgotność ≥ 88% | 1 (2 przy ≤ −2°C) |
| Możliwe lokalne oblodzenie (mosty) | nawierzchnia 0…+2°C, powietrze ≤ 3°C, wilgoć | 1 |
| Śnieg | ≥ 0,1 / 1 / 2,5 cm/h | 1 / 2 / 3 |
| Mokry śnieg, błoto pośniegowe | śnieg przy −1…+2°C | ≥ 1 |
| Deszcz / aquaplaning | ≥ 0,5 / 4 / 10 mm/h | 1 / 2 / 3 |
| Mgła | widoczność < 1000 / 300 / 150 m | 1 / 2 / 3 |
| Porywy wiatru | ≥ 55 / 75 / 95 km/h | 1 / 2 / 3 |
| Ostrzeżenie IMGW | aktywne w powiecie, dotyczy dróg | stopień + 1 (maks. 3) |

Progi są punktem wyjścia. **Przed komercjalizacją trzeba je zweryfikować** na danych historycznych (np. pomiary nawierzchni GDDKiA, zdarzenia drogowe).

## Uruchomienie

```bash
npm install
npm run dev        # serwer deweloperski
npm test           # testy jednostkowe (silnik ryzyka, trasa, czas)
npm run build      # wersja produkcyjna w dist/
```

Tryb demonstracyjny (syntetyczne dane pogodowe, oznaczony w interfejsie): dodaj `?demo` do adresu.

Dane statyczne:

```bash
node scripts/build_polska.mjs                                   # kontur Polski (Natural Earth)
python3 scripts/build_powiaty.py public/data/powiaty.geojson    # granice powiatów z OSM (wolne: limit 1 zapytanie/s)
node scripts/icons.mjs                                          # ikony PWA z public/icons/icon.svg
```

## Architektura

```
src/
  risk/engine.ts      reguły ryzyka (czyste funkcje, testy)
  risk/route.ts       pogoda na trasie, najlepszy wyjazd, odcinki
  data/               Open-Meteo, IMGW, OSRM, Photon, powiaty, tryb demo
  alerts/             zapisane trasy (IndexedDB), sprawdzanie, powiadomienia
  views/              Teraz, Trasa, Mapa, Alerty
  components/         mapa (MapLibre), wyszukiwarka, wykres profilu, karty
  sw.ts               service worker: cache, sprawdzanie w tle, kliknięcia powiadomień
```

Dostawca prognozy jest odizolowany w `src/data/openMeteo.ts`. Zamiana na płatne źródło wymaga zmiany jednego modułu.

## Ograniczenia i kolejne kroki

1. **Licencja Open-Meteo:** darmowe API wolno używać tylko niekomercyjnie. Przed startem z reklamami lub abonamentem potrzebny płatny plan albo inne źródło.
2. **Routing:** publiczny serwer OSRM jest demonstracyjny, bez gwarancji. Do produkcji potrzebna własna instancja (OSRM/Valhalla) albo płatne API.
3. **Powiadomienia:** sprawdzanie w tle działa przez Periodic Background Sync (Chrome/Edge, zainstalowana aplikacja). Niezawodne powiadomienia na iOS i we wszystkich przeglądarkach wymagają **serwera Web Push** (kolejny etap).
4. **Temperatura nawierzchni:** największy skok jakości dałyby pomiary GDDKiA lub komercyjny model nawierzchni.
5. Czas przejazdu nie uwzględnia korków ani wolniejszej jazdy w złych warunkach.
