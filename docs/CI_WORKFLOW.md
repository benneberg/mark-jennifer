# Proposed CI workflow update

`.github/workflows/deploy.yml` could not be updated in the branch that shipped
the hardening work, because the GitHub App token used for that push lacks the
`workflows` permission (`refusing to allow a GitHub App to create or update
workflow .github/workflows/deploy.yml without workflows permission`).

Nothing is broken: the existing workflow already runs `npm ci` when a
`package-lock.json` is present (it now is), and `npm run lint` / `npm test`
still exist, so the new 36-test suite runs in CI as-is.

Apply the changes below by hand (or from a token with `workflow` scope) to get
the remaining benefits: dependency caching, Node version from `.nvmrc`, an
explicit CSP assertion, and no duplicated install/build between jobs.

```yaml
name: Validate, Build, and Deploy to GitHub Pages

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  validate:
    name: Validate & Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci --legacy-peer-deps
      - name: Validate JSON schemas parse
        run: |
          node -e '
            const fs = require("fs");
            const path = require("path");
            for (const file of fs.readdirSync("schemas")) {
              if (!file.endsWith(".json")) continue;
              JSON.parse(fs.readFileSync(path.join("schemas", file), "utf8"));
            }
          '
      - name: TypeScript check (strict)
        run: npm run typecheck
      - name: Unit tests
        run: npm test
      - name: Verify production build
        run: npm run build
      - name: Verify the built bundle ships a CSP
        run: grep -q 'http-equiv="Content-Security-Policy"' dist/index.html

  # build/deploy jobs: same as today, but replace the two setup-node/install
  # blocks with the cached versions above.
```

Why each change matters:

| Change | Reason |
| :--- | :--- |
| `node-version-file: .nvmrc` | CI, README and local dev stop drifting apart. |
| `cache: npm` | Cuts ~20s per job and stops hammering the registry. |
| `npm ci` (lockfile committed) | Reproducible builds; `^` ranges can no longer change a green deploy into a red one overnight. |
| CSP assertion | The policy is injected at build time by `vite.config.ts`; this makes a silent regression impossible. |
| Single install/build | `validate` and `build` currently install and build twice for every push. |
