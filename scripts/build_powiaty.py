"""Jednorazowe budowanie granic powiatów (TERYT) z OpenStreetMap przez Nominatim.

Dane: © OpenStreetMap contributors, ODbL. Skrypt respektuje limit 1 zapytanie/s.
Użycie: python3 scripts/build_powiaty.py public/data/powiaty.geojson
"""
import json, sys, time, urllib.request, urllib.parse

UA = "pogoda-drogowa-build/0.1"
BASE = "https://nominatim.openstreetmap.org"
_last = [0.0]

def get(path, params):
    wait = 1.1 - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    url = f"{BASE}/{path}?{urllib.parse.urlencode(params)}"
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "pl"})
            with urllib.request.urlopen(req, timeout=40) as r:
                _last[0] = time.time()
                return json.load(r)
        except Exception as e:  # noqa
            _last[0] = time.time()
            print("  retry", attempt, e, file=sys.stderr)
            time.sleep(3 * (attempt + 1))
    return None

def ring_contains(ring, x, y):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi:
            inside = not inside
        j = i
    return inside

def geom_contains(g, x, y):
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]] if g["type"] == "Polygon" else []
    for poly in polys:
        if poly and ring_contains(poly[0], x, y) and not any(ring_contains(h, x, y) for h in poly[1:]):
            return True
    return False

def rnd(g):
    def r(c):
        return [r(x) for x in c] if isinstance(c[0], list) else [round(c[0], 4), round(c[1], 4)]
    return {"type": g["type"], "coordinates": r(g["coordinates"])}

def main(out):
    poland = get("lookup", {"osm_ids": "R49715", "format": "geojson", "polygon_geojson": 1, "polygon_threshold": 0.01})
    pl_geom = poland["features"][0]["geometry"]
    features, seen = [], set()
    try:
        features = json.load(open(out))["features"]
        print(f"wznawiam od {len(features)} powiatów", file=sys.stderr)
    except Exception:
        pass
    lat, step_lat, step_lon = 49.0, 0.1, 0.15
    pts = []
    while lat <= 54.9:
        lon = 14.1
        while lon <= 24.2:
            if geom_contains(pl_geom, lon, lat):
                pts.append((lon, lat))
            lon += step_lon
        lat += step_lat
    print(f"{len(pts)} punktów siatki", file=sys.stderr)
    for k, (x, y) in enumerate(pts):
        if any(geom_contains(f["geometry"], x, y) for f in features):
            continue
        rev = get("reverse", {"lat": y, "lon": x, "zoom": 8, "format": "jsonv2", "extratags": 1,
                              "polygon_geojson": 1, "polygon_threshold": 0.003})
        if not rev or rev.get("osm_type") != "relation":
            continue
        terc = (rev.get("extratags") or {}).get("teryt:terc", "")
        rid = rev["osm_id"]
        if len(terc) != 4 or rid in seen:
            seen.add(rid)
            continue
        seen.add(rid)
        geom = rev.get("geojson")
        if not geom or geom.get("type") not in ("Polygon", "MultiPolygon"):
            continue
        if any(f["properties"]["t"] == terc for f in features):
            continue
        name = rev.get("name", "")
        features.append({"type": "Feature", "properties": {"t": terc, "n": name}, "geometry": rnd(geom)})
        print(f"[{k}/{len(pts)}] {terc} {name} (razem {len(features)})", file=sys.stderr)
        if len(features) % 20 == 0:
            json.dump({"type": "FeatureCollection", "features": features}, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump({"type": "FeatureCollection", "features": features}, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump({"type": "Feature", "properties": {}, "geometry": rnd(pl_geom)}, open(out.replace("powiaty", "polska"), "w"), separators=(",", ":"))
    print("GOTOWE", len(features), file=sys.stderr)

def refine(out, step=0.02):
    """Drugi przebieg: małe miasta na prawach powiatu, które ominęła rzadka siatka.
    Pyta tylko o punkty w "dziurach" (punkt i 4 sąsiedzi poza znanymi powiatami)."""
    features = json.load(open(out))["features"]
    pl = json.load(open(out.replace("powiaty", "polska")))["geometry"]
    for f in features:
        g = f["geometry"]
        rings = [g["coordinates"][0]] if g["type"] == "Polygon" else [p[0] for p in g["coordinates"]]
        xs = [c[0] for r in rings for c in r]; ys = [c[1] for r in rings for c in r]
        f["_bb"] = (min(xs), min(ys), max(xs), max(ys))

    def covered(x, y):
        return any(f["_bb"][0] <= x <= f["_bb"][2] and f["_bb"][1] <= y <= f["_bb"][3]
                   and geom_contains(f["geometry"], x, y) for f in features)

    holes = []
    y = 49.0
    while y <= 54.9:
        x = 14.1
        while x <= 24.2:
            if geom_contains(pl, x, y) and not covered(x, y):
                d = step
                if all(not covered(x + dx, y + dy) for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d))):
                    holes.append((x, y))
            x += step
        y += step
    print(f"{len(holes)} punktów w dziurach", file=sys.stderr)
    added = 0
    for x, y in holes:
        if covered(x, y):
            continue
        rev = get("reverse", {"lat": y, "lon": x, "zoom": 8, "format": "jsonv2", "extratags": 1,
                              "polygon_geojson": 1, "polygon_threshold": 0.003})
        if not rev or rev.get("osm_type") != "relation":
            continue
        terc = (rev.get("extratags") or {}).get("teryt:terc", "")
        geom = rev.get("geojson")
        if len(terc) != 4 or not geom or geom.get("type") not in ("Polygon", "MultiPolygon"):
            continue
        if any(f["properties"]["t"] == terc for f in features):
            continue
        f = {"type": "Feature", "properties": {"t": terc, "n": rev.get("name", "")}, "geometry": rnd(geom)}
        g = f["geometry"]
        rings = [g["coordinates"][0]] if g["type"] == "Polygon" else [p[0] for p in g["coordinates"]]
        xs = [c[0] for r in rings for c in r]; ys = [c[1] for r in rings for c in r]
        f["_bb"] = (min(xs), min(ys), max(xs), max(ys))
        features.append(f)
        added += 1
        print(f"+ {terc} {f['properties']['n']} (razem {len(features)})", file=sys.stderr)
    for f in features:
        f.pop("_bb", None)
    json.dump({"type": "FeatureCollection", "features": features}, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
    print("UZUPEŁNIONO", added, "razem", len(features), file=sys.stderr)


if __name__ == "__main__":
    if "--refine" in sys.argv:
        refine(sys.argv[1])
    else:
        main(sys.argv[1])
