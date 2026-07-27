import fs from 'fs'
import path from 'path'

/**
 * Guards for config.production.js — the template the deploy renders over
 * dist/config.js. Their job is to keep a real Meilisearch key out of the repo
 * and to keep the shipped config from ever pointing at a developer's machine.
 *
 * The template is evaluated by hand rather than `require`d: jest.config.js maps
 * anything matching /config/ to config.js, which would silently hand us the
 * wrong file. Evaluating it also lets us supply a known origin and exercise the
 * key substitution the deploy performs.
 */
const templatePath = path.resolve(__dirname, '..', 'config.production.js')
const raw = fs.readFileSync(templatePath, 'utf-8')

const ORIGIN = 'https://roadrisk.example.test'

function evaluateTemplate(searchKey?: string): any {
    const src = searchKey ? raw.replace('__MEILI_SEARCH_KEY__', searchKey) : raw
    const load = new Function('window', 'module', src + '\nreturn config')
    return load({ location: { origin: ORIGIN } }, { exports: {} })
}

describe('config.production.js', () => {
    it('carries only the key placeholder, never a real key', () => {
        expect(raw).toContain('__MEILI_SEARCH_KEY__')
        // A Meilisearch key is 64 hex chars. Nothing of that shape belongs in
        // git — the deploy substitutes the real one from $MEILI_SEARCH_KEY.
        expect(raw).not.toMatch(/\b[0-9a-f]{64}\b/)
    })

    it('derives every backend URL from the serving origin', () => {
        const config = evaluateTemplate('a'.repeat(64))
        // Same-origin paths are what let one build serve any hostname; Caddy
        // maps these prefixes onto GraphHopper and Meilisearch.
        expect(config.routingApi).toBe(`${ORIGIN}/api/`)
        expect(config.geocoder.url).toBe(`${ORIGIN}/search`)
        expect(config.geocodingApi).toBe('')
    })

    it('never resolves to a developer machine', () => {
        const config = evaluateTemplate('b'.repeat(64))
        const values = JSON.stringify(config)
        expect(values).not.toMatch(/localhost|127\.0\.0\.1/)
    })

    it('leaves the geocoder unattached when no key was substituted', () => {
        const config = evaluateTemplate()
        // With the placeholder still in place the UI must fall back to
        // right-clicking the map rather than issuing broken search requests.
        expect(config.geocoder).toBeUndefined()
    })

    it('requests only path details the road-risk graph exposes', () => {
        const config = evaluateTemplate()
        // GraphHopper rejects the whole /route request if any requested detail
        // is missing from graph.encoded_values, so these three must stay out.
        expect(config.request.details).toContain('road_risk')
        expect(config.request.details).not.toContain('surface')
        expect(config.request.details).not.toContain('toll')
        expect(config.request.details).not.toContain('track_type')
    })
})
