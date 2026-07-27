/**
 * Production UI config — served as a standalone <script>, NOT bundled.
 *
 * Why this file exists: webpack.common.js prefers `config-local.js` over
 * `config.js` for *every* build, production included. So `npm run build` on a
 * dev machine writes that machine's dev config — localhost URLs and the dev
 * Meilisearch key — straight into `dist/config.js`. Because config.js is
 * external to the bundle (`externals: config`), the deploy renders this file
 * over `dist/config.js` after the build. See ../graphhopper/deploy/deploy.sh.
 *
 * All URLs are same-origin: Caddy maps /api -> GraphHopper and /search ->
 * Meilisearch, so this works at any hostname with no rebuild.
 */

// Substituted at deploy time from $MEILI_SEARCH_KEY. Left as the literal
// placeholder (or empty) when search is not being deployed, in which case the
// geocoder block below is simply not attached and the UI falls back to
// right-clicking the map to set start/end.
const MEILI_SEARCH_KEY = '__MEILI_SEARCH_KEY__'

const origin = typeof window !== 'undefined' ? window.location.origin : ''

const config = {
    routingApi: origin + '/api/',
    // Self-hosted GraphHopper ships no geocoder; address search comes from the
    // Meilisearch block below, when it is configured.
    geocodingApi: '',
    defaultTiles: 'OpenStreetMap',
    keys: {
        graphhopper: '',
        maptiler: 'missing_api_key',
        omniscale: 'missing_api_key',
        thunderforest: 'missing_api_key',
        kurviger: 'missing_api_key',
        tracestrack: 'missing_api_key',
    },
    routingGraphLayerAllowed: false,
    request: {
        // Must be a subset of the graph's graph.encoded_values — GraphHopper
        // rejects the whole /route request if any requested detail is missing.
        // These six are what config-w-road-risk.yml exposes; note the absence of
        // surface/toll/track_type, which the upstream default asks for.
        details: ['road_class', 'road_environment', 'max_speed', 'average_speed', 'road_access', 'road_risk'],
    },
    profile_group_mapping: {},
}

// Attach the geocoder only if a real key was substituted in. Keeping this as a
// runtime check rather than having the deploy script cut the block out means
// this file is always valid JavaScript, whether or not substitution happened.
if (MEILI_SEARCH_KEY && !MEILI_SEARCH_KEY.startsWith('__')) {
    config.geocoder = {
        provider: 'meilisearch',
        url: origin + '/search',
        // SEARCH-ONLY key (actions: ["search"]). This is public by design — it
        // ships to every browser. The master key must never appear here; it
        // stays in the Meilisearch container's .env on the server.
        key: MEILI_SEARCH_KEY,
        indexes: ['addresses', 'pois'],
        limit: 8,
    }
}

// needed for jest
if (typeof module !== 'undefined' && module) module.exports = config
