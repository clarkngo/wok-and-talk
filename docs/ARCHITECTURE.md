# Wok & Talk — Architecture

## Decision: vanilla ES modules, no build step

| Option | Verdict |
|---|---|
| Framework SPA (React/Vue + bundler) | Build pipeline, `node_modules`, Pages config. Overkill for this game. |
| Single giant `script.js` | Simple at first, but gets hard to work in once there are 5+ restaurants. |
| **Native ES modules + JSON content** ✅ | Zero tooling, deploys as-is to GitHub Pages, and each part lives in its own small file. |

The browser loads `js/main.js` with `<script type="module">`, and imports resolve natively. All game *content* is JSON under `data/`, so adding a restaurant means writing data, not code.

> ES modules and `fetch()` don't work from `file://`. Run `python3 tools/dev-server.py` for local development.

## Layers

```
index.html            App shell: top bar, <section data-screen> per screen, two <dialog>s
css/
  base.css            Design tokens (light + dark), reset, layout, script/layer visibility rules
  components.css      Buttons, cards, dialogue box, menu sheet, receipt, settings, toasts
js/
  main.js             Boot + navigation (nav.toHub / toDining / toCheckout)
  core/               State and I/O. No rendering.
    schema.js         Player-state defaults, versioned MIGRATIONS, sanitizer for untrusted input
    store.js          getState / update / subscribe, localStorage, Import/Export, cross-tab sync
    actions.js        Every state mutation (startMeal, recordAnswer, completeMeal, setSetting…)
    content.js        fetch + cache data/*.json; lints restaurants in the console
    speech.js         Web Speech API (zh-CN voice) wrapper
  engine/             Pure game rules: no DOM, no state. Unit-testable in Node.
    dialogue.js       Node lookup, choice grading/retry, effects/flags, {placeholder} interpolation
    order.js          Prices, merging cart lines, trilingual order descriptions & "say it" phrases
    rewards.js        Level curve, star rating, reward scaling, badge rules
    validate.js       Content linter (dangling node ids, unreachable nodes, bad option refs…)
  ui/                 One module per screen/modal. Reads state, calls actions, renders DOM.
    dom.js            h() hyperscript helper (text-only, so no HTML injection)
    text.js           tri(): renders {zh, zht, py, en} as stacked layers + 🔊 button
    voice.js          Tap-to-speak: one delegated listener reads any [lang|=zh] text aloud
    screens.js        Screen router
    hub.js / dining.js / menu.js / checkout.js / settings.js / toast.js
data/
  catalog.json        Hub cards + badge definitions
  restaurants/<id>.json
schemas/              Formal JSON Schemas (editor autocomplete via "$schema")
tools/
  dev-server.py       No-cache static server
  validate-content.mjs  `node tools/validate-content.mjs`, a content linter for CI
```

**Data flow:** UI event → `actions.*` → `store.update()` → localStorage + `subscribe` listeners → UI re-reads state. UI modules never mutate state directly, and engine modules never touch the DOM.

**Screen flow:** `Hub → Dining Room ⇄ Menu Modal → Dining Room → Checkout → Hub`. The dining room is driven entirely by the restaurant's dialogue graph. A node's `action` hands off to the menu modal (`openMenu`) or to checkout (`checkout`).

**Language layers:** every string is `{ zh, zht?, py, en }`. `tri()` renders all layers. Classes on `<html>` (`hide-pinyin`, `hide-english`, `script-traditional`) decide what's visible, so toggles are instant and never re-render. When a layer is hidden, tapping a line peeks at it. Tapping any Chinese text speaks it (Settings › *Tap Chinese to hear it*). Mark controls that aren't meant to be read with `data-no-speak`.

## Player state (`localStorage["wok-and-talk/save"]`)

Formal spec: [`schemas/player-state.schema.json`](../schemas/player-state.schema.json). Example: [`docs/sample-save.json`](sample-save.json).

```jsonc
{
  "meta":     { "app": "wok-and-talk", "schemaVersion": 1, "createdAt": "…", "updatedAt": "…" },
  "profile":  { "name": "Foodie" },
  "settings": { "showPinyin": true, "showEnglish": true, "script": "simplified", "autoSpeak": false, "speechRate": 0.9 },
  "wallet":   { "cny": 100 },
  "progress": { "exp": 0, "mealsCompleted": 0, "badges": { "first-bite": "2026-10-06T…" } },
  "restaurants": { "noodle-shop": { "visits": 1, "completions": 1, "bestScore": 86, "bestStars": 2, "lastVisitedAt": "…" } },
  "phrasebook":  { "noodle-shop/greet/one-wei": { "seen": 1, "correct": 1, "lastSeenAt": "…" } },
  "activeMeal":  null   // or { restaurantId, nodeId, order[], score, maxScore, answered{}, flags{}, startedAt }
}
```

- **Export** writes an envelope `{ app, schemaVersion, exportedAt, state }` as `wok-and-talk-save-YYYY-MM-DD.json`.
- **Import** accepts the envelope or a bare state. It goes through `parseSave()`, which:
  1. rejects anything that isn't a Wok & Talk save or comes from a *newer* schema version,
  2. runs `MIGRATIONS` to upgrade older versions,
  3. rebuilds the state from defaults, copying only well-typed values (clamps numbers, drops `__proto__` keys, discards a malformed `activeMeal`).
  The player sees a summary preview and confirms before anything is overwritten.
- A corrupt localStorage save is backed up to `wok-and-talk/save.corrupt-<timestamp>`, and the game starts fresh with a toast.
- **Schema changes:** bump `SCHEMA_VERSION`, add `MIGRATIONS[oldVersion] = (s) => { …; s.meta.schemaVersion = new; return s; }`, and update the JSON Schema.

## Restaurant data (`data/restaurants/<id>.json`)

Formal spec: [`schemas/restaurant.schema.json`](../schemas/restaurant.schema.json). Working example: [`noodle-shop.json`](../data/restaurants/noodle-shop.json).

```jsonc
{
  "id": "noodle-shop",
  "name": { "zh": "兰州拉面馆", "zht": "蘭州拉麵館", "py": "Lánzhōu Lāmiàn Guǎn", "en": "…" },
  "scene": { "emoji": "🍜", "props": ["🏮", "🥢"], "colors": ["#ffd27a", "#ef6b3a"] },
  "startNode": "greet",
  "rewards": { "exp": 60, "cny": 40 },              // for a perfect meal; scaled 50–100%
  "npcs": { "host": { "avatar": "👩", "name": { "zh": "老板娘", … } } },
  "dialogue": {
    "greet": {
      "speaker": "host",
      "line": { "zh": "欢迎光临！几位？", "py": "Huānyíng guānglín! Jǐ wèi?", "en": "…" },
      "choices": [
        { "id": "one-wei", "text": {…}, "grade": "best", "feedback": "…", "note": "…", "next": "seat" },
        { "id": "want-noodles", "text": {…}, "grade": "wrong", "feedback": "…" }   // no next → retry
      ]
    },
    "seat":    { "speaker": "host", "line": {…}, "note": "…", "next": "server-greet" },   // Continue button
    "menu":    { "speaker": "server", "line": {…}, "action": "openMenu", "next": "confirm" },
    "confirm": { "speaker": "server", "line": { "zh": "您点的是{order}。对吗？", … }, "choices": [...] },
    "checkout":{ "speaker": "host", "line": {…}, "action": "checkout" }
  },
  "menu": {
    "optionGroups": {
      "spice":    { "type": "single", "label": {…}, "choices": [ { "id": "less", "text": { "zh": "少辣", … }, "default": true } ] },
      "cilantro": { "type": "single", "label": {…}, "choices": [ { "id": "yes", …, "silent": true }, { "id": "no", "text": { "zh": "不要香菜", … } } ] },
      "extras":   { "type": "multi",  "label": {…}, "choices": [ { "id": "egg", "text": { "zh": "加蛋", … }, "price": 3 } ] }
    },
    "categories": [
      { "id": "noodles", "name": {…}, "items": [
        { "id": "beef-noodle-soup", "emoji": "🍜", "name": {…}, "price": 18, "tags": ["signature"],
          "options": ["noodleShape", "spice", "cilantro", "extras"], "note": "…" } ] }
    ]
  }
}
```

**Dialogue rules**
- A node has `choices` (player replies), an `action`, or only `next` (Continue button).
- `grade`: `best` = 10 pts, `ok` = 5, `wrong` = 0, `neutral` = unscored. Only the first graded answer on each node counts. A `wrong` choice with no `next` lets the player try again.
- `effects: [{ "type": "setFlag", "flag": "payment", "value": "qr" }]` sets meal flags. `{ "type": "addItem", "item": "har-gow", "qty": 1 }` puts a menu item on the bill straight from dialogue (dim sum tea and push carts). `requires: { "flags": { "askedChopsticks": true } }` shows a choice only when those flags match.
- Placeholders available in lines: `{order}` (trilingual order summary) and `{total}` (¥ amount).

**Adding a restaurant:** create `data/restaurants/<id>.json`, flip its catalog entry to `"status": "playable"`, then run `node tools/validate-content.mjs`.

**Badge rules:** `mealsCompleted`, `restaurantsCompleted`, `perfectMeal`, `orderedChoice`, `mealFlag` (a flag set during that meal). **Adding a badge rule:** add a function to `BADGE_RULES` in `js/engine/rewards.js` and a branch to `catalog.schema.json`.
