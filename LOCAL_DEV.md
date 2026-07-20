# Running the UI against a local GraphHopper

Notes for running this UI (`npm run serve`) against a locally-running GraphHopper
backend — in particular the crash-risk ("road-risk") fork that exposes the
`road_risk` encoded value and the `car` / `car_plain` profiles.

## 1. Start the backend

Run your local GraphHopper so it listens on `http://localhost:8989`. The road-risk
fork ships `config-w-road-risk.yml` (profiles `car` = car + road_risk overlay and
`car_plain` = baseline) and serves on `:8989`. CORS is enabled server-side
(`Access-Control-Allow-Origin: *`), so the UI dev server on `:3000` can call it
cross-origin without a proxy.

## 2. Point the UI at it via `config-local.js`

The committed `config.js` uses same-origin URLs (`window.location.origin`), which
assume the UI is served *by* GraphHopper. For local development with `npm run serve`
(which runs on `:3000`), create a **`config-local.js`** — it is git-ignored and
overrides `config.js` (see `webpack.common.js`). Minimal example:

```js
const config = {
    routingApi: 'http://localhost:8989/',
    // self-hosted GraphHopper has no geocoder — disable address search and set
    // start/end by right-clicking the map instead
    geocodingApi: '',
    defaultTiles: 'OpenStreetMap',
    keys: { graphhopper: '<key>', maptiler: 'missing_api_key', omniscale: 'missing_api_key',
            thunderforest: 'missing_api_key', kurviger: 'missing_api_key', tracestrack: 'missing_api_key' },
    routingGraphLayerAllowed: false,
    request: {
        // IMPORTANT: only request path details the graph actually imported.
        // GraphHopper rejects the ENTIRE /route request if any requested detail is
        // missing (symptom in the UI: "Cannot find the path details: [surface, toll,
        // track_type]" and no route). The road-risk graph imports:
        //   road_class, road_environment, max_speed, average_speed, road_access, road_risk
        // (surface / toll / track_type are NOT in graph.encoded_values there).
        details: ['road_class', 'road_environment', 'max_speed', 'average_speed', 'road_access', 'road_risk'],
    },
    profile_group_mapping: {},
}
if (module) module.exports = config
```

Check which details a graph supports with the `/info` endpoint
(`curl -s localhost:8989/info | jq .encoded_values`) or by requesting one detail at a
time. Then `npm run serve` and open http://localhost:3000. Selecting `road_risk` in
the path-detail graph visualises crash risk along the route.

### Optional: address + POI search via `address-poi-search`

Instead of setting start/end by right-clicking the map, run the sibling
`../address-poi-search` Meilisearch (`docker compose up -d`, then `python index_addresses.py`
/ `index_places.py`) and add a `geocoder` block to `config-local.js` — all forward geocoding
then goes through Meilisearch's `/multi-search` (the `geocodingApi` value is unused), and the
search box works despite GraphHopper having no geocoder:

```js
    geocoder: {
        provider: 'meilisearch',
        url: 'http://localhost:7700/',
        key: '<SEARCH-ONLY key>', // actions:["search"] — NEVER the master key
        indexes: ['addresses', 'pois'],
        limit: 8,
    },
```

Get a search-only key (the master key lives in `../address-poi-search/.env`):

```bash
curl -sS -H "Authorization: Bearer $(grep '^MEILI_MASTER_KEY=' \
  ../address-poi-search/.env | cut -d= -f2-)" http://localhost:7700/keys \
  | jq -r '.results[]|select(.name=="Default Search API Key").key'
```

The result schema each hit follows is pinned in `../address-poi-search/contract.json`.

## 3. Run `npm ci` after any dependency bump

If the app fails to compile with type errors like
`Generic type 'MapBrowserEvent<EVENT>' requires 1 type argument` or
`RefObject<HTMLDivElement | null>' is not assignable to 'LegacyRef<...>'`, the cause
is usually a **stale `node_modules`**: the manifest and lockfile were bumped (e.g. #433
moved to React 19 / OpenLayers 10.6 / css-loader 7) but the install was never
refreshed. The code is correct for the *declared* versions — run `npm ci` to install
them, don't patch the annotations.
