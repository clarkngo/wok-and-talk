# 🥢 Wok & Talk · 边吃边学

Learn restaurant Mandarin by eating your way through Chinese restaurants. Get seated, order (少辣, 不要香菜!), and ask for the bill. Every line is shown in **Simplified/Traditional Chinese**, **tone-marked Pinyin**, and **English**, and you can turn each layer on or off.

A static site with no backend or build step, hosted on GitHub Pages. Progress lives in `localStorage`, with JSON **Export / Import** for backups and moving between devices.

## Run locally

ES modules can't load from `file://`, so serve the folder:

```bash
python3 tools/dev-server.py
```

Then open http://localhost:8000.

## Deploy

Every push to `main` deploys through `.github/workflows/static.yml` (it uploads the repo root to GitHub Pages). All paths are relative, so it works under `/<repo-name>/`.

## Content

```bash
node tools/validate-content.mjs
```

This lints the dialogue graphs and menus: it catches dangling node ids, unreachable nodes, unknown option groups, and missing translations.

- `data/catalog.json` holds the hub restaurant list and badges
- `data/restaurants/<id>.json` holds the NPCs, dialogue tree, and menu for one restaurant
- `schemas/*.schema.json` are the formal JSON Schemas (point `$schema` at them for editor autocomplete)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module layout, data flow, and schema reference.

## Status

| Restaurant | Difficulty |
|---|---|
| 🍱 好味快餐 Tasty Express (Fast Casual) | ⭐ Easy |
| 🍜 兰州拉面馆 Lanzhou Noodle House | ⭐ Easy |
| 🥟 金龙茶楼 Golden Dragon Teahouse (Dim Sum) | ⭐⭐ Medium |
| 🍲 重庆老火锅 Old Chongqing Hot Pot | ⭐⭐ Medium |
| 🌶️ 蜀香川菜馆 Shu Fragrance Sichuan Kitchen | ⭐⭐⭐ Hard |
