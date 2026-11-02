# OTDR Reader

Browser viewer for Telcordia SR-4731 version 2 SOR files. Marketing pages live at `/`. The viewer is a Svelte app at `/app/`. The file is decoded in the browser.

The decoder is an ES module port of [jsOTDR](https://github.com/sid5432/jsOTDR) via [Sor-Viewer](https://github.com/moosler/Sor-Viewer).

## Develop

```bash
npm install --prefix frontend
npm run dev
```

- Marketing: http://localhost:5173/
- Viewer: http://localhost:5173/app/

## Build

```bash
npm run build --prefix frontend
```

`frontend/dist` has the marketing files at the root and the app at `dist/app/` after `npm run build:pages`. Plain `npm run build` is the Vite build with base `/app/`, used for local preview and for Firebase Hosting (`frontend/firebase.json` rewrites only `/app/**`).

GitHub Pages runs `npm run build:pages`, which prefixes links with the repository name.

## License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) 2025-present, Tony Melek

The SOR parser in `frontend/src/lib/sor` is the port of [Sor-Viewer](https://github.com/moosler/Sor-Viewer):

Copyright (c) 2019-present, Marco Moosler
