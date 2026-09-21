# Contributing

Thanks for helping. This is a small, focused library: a browser receiver for animated BC-UR QR codes. Contributions that keep it focused, tested, and honest are very welcome.

## Your first PR: add a verified compatibility row

The single most useful contribution is a real interop data point. Pick a browser or a hardware sender, run the [demo](demo/) or your own integration against it, and add a row to [`docs/compat.md`](docs/compat.md) with your GitHub handle and the date in the "Verified by" column. For senders, include the fragment size / fps / ECC that worked. A "no, it fails like this" row is just as valuable as a "yes". This is the canonical starter task and needs no code.

## Development

```bash
pnpm install          # package-local; nothing outside this folder is touched
pnpm typecheck        # tsc, strict
pnpm test             # vitest: core + fixture + jsdom DOM specs
pnpm build            # tsup -> dist (ESM + d.ts)
pnpm fixtures         # regenerate tests/fixtures from @ngraveio/bc-ur
pnpm demo:build       # bundle the demo into demo/dist
pnpm e2e              # Playwright smoke of the demo (needs `playwright install`)
```

## Ground rules

- **TypeScript strict, ESM.** No new runtime dependency without discussion; the core is deliberately dependency-light. `jsqr` stays an optional peer.
- **Respect the three layers.** Decode core (no DOM), frame sources (produce strings), UI (the element). Do not leak the DOM into the core or `@ngraveio/bc-ur` internals into the public API. See [architecture](docs/explanation/architecture.md).
- **Do not reimplement the UR spec.** Fountain decoding and UR parsing belong upstream in `@ngraveio/bc-ur`.
- **Every public export needs TSDoc with an `@example`.** Every snippet in the README or tutorial must be backed by a real file under `examples/` (compiled by `pnpm typecheck`) so docs cannot rot.
- **Tests before merge.** New behavior needs a fixture-driven test. The out-of-order and 40%-loss decode tests must stay green; they encode the core promise.
- **Docs are the product.** A feature is not done until its behavior is in the [reference](docs/reference.md) and, if user-facing, a how-to.
- **No em dashes in docs or commits**, and no telemetry, ever.

## Reporting bugs and security

Functional bugs: open an issue with a minimal fixture (an array of part strings reproduces almost anything without a camera). Security issues (the camera is a sensitive surface): see [SECURITY.md](SECURITY.md), do not open a public issue.

## Releasing

1. Bump the version in package.json and add a CHANGELOG.md entry (where the repo keeps one).
2. Tag and push: git tag vX.Y.Z && git push origin vX.Y.Z.
3. .github/workflows/release.yml builds, tests, and runs npm publish --provenance for that tag. The tag must equal "v" plus the package.json version, otherwise the job stops before publishing.

One-time setup on npmjs.com (package Settings, Trusted Publisher): provider GitHub Actions, organization or user nkwib, repository ur-scanner, workflow filename release.yml, environment left blank. Under Allowed actions tick "Allow npm publish": a new trusted publisher only allows "npm stage publish" by default, and the workflow's direct npm publish then fails with "403 OIDC permission denied for this action". Set this when you create the connection: npm does not allow editing a trusted publisher afterwards, so a stage-only connection has to be deleted and added again.
