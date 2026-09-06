# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

---

# Project Bright — Video Reviewer

Review a finished video **as its parts**. Two screens: every video found on disk, and one video
broken into the sections it was rendered from.

## Run

```
# 1. the data + media server (from apps/claude-remotion)
node scripts/serve-reviewer.mjs            # http://127.0.0.1:5199

# 2. the app — either
npm run dev                                # http://127.0.0.1:5173, proxies /api + /media
npm run build                              # or build once; the server then serves it on :5199
```

A video only appears as reviewable once its parts have been rendered:

```
node scripts/render-sections.mjs --record ../../studio/projects/<project>/records/VIDEO_RECORD.json
```

## What this is

A COPY of video-bright's frontend, taken so the editing surface is already here when the editing
phase begins. `TimelineEditor`, `SlotPanel`, `SlotCard`, `CommentThread` and the rest are still in
`src/`, untouched and **unrouted** — nothing imports them, so none of their API calls run and no
backend is needed. `apps/video-bright-mvp` itself is not modified and is never imported from.

The reviewer's only write is a per-section verdict appended to the record's `review[]`.
