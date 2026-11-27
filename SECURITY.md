# Security policy

Hedetangen AI Marketing Studio is a client-side app: there is no server, no
account system, and no telemetry. The only network calls are the ones the owner
triggers with their own API key.

## Reporting a vulnerability

Please **do not** open a public issue for a security problem. Report it privately
via GitHub's ["Report a vulnerability"](https://github.com/benneberg/mark-jennifer/security/advisories/new)
advisory flow, or email the maintainer listed on the GitHub profile.

Include: what you did, what happened, what you expected, and the browser/OS.

## What is in scope

- API key handling (`src/storage/crypto.ts`): encryption, storage, lifecycle.
- XSS through AI output or user input (`src/utils/markdown.tsx`, prompts).
- Import/export validation (`src/storage/entities.ts`, `src/utils/validate.ts`).
- The Content-Security-Policy injected by `vite.config.ts`.

## Known and accepted limitations

- The AES-GCM master key is stored in the same browser origin as the ciphertext.
  This protects against casual inspection of IndexedDB, **not** against XSS, a
  malicious extension, or a compromised browser. A stricter model would require a
  passphrase on every launch.
- A key stored in session memory (remember-key off) survives until the tab is
  reloaded; "Clear all data" explicitly wipes it.
- Old exports are validated against a draft-07 subset only. Unsupported schema
  keywords are rejected rather than ignored, but semantically hostile-but-valid
  content (e.g. prompt text inside an expert system prompt) is still trusted,
  because importing a workspace is an explicit owner action.
