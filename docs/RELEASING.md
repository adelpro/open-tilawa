# Releasing

## Repo version

The root `package.json` carries the release coordinate for the repository as a
whole (`open-tilawa`, private). It is deliberately **not** a workspace root: no
app reads it, and each app keeps its own version and its own build. Its job is to
answer "what was in that repo release?" without diffing branches.

| Repo | web | admin | seeder |
|---|---|---|---|
| 1.5.7 | 1.4.7 | 1.24.0 | 1.4.2 |

Bump the root version when you tag a repo release, and name the three app
versions in the tag notes.

## App versions

Three apps ship independently and carry their own version:

| App | Package | Version also in |
|---|---|---|
| `apps/web` | `apps/web/package.json` | nothing else: `APP_VERSION` is imported from it at build, and the header and about page read that |
| `apps/admin` | `apps/admin/package.json` (workspaces: `apps/api`, `apps/web`, `libs/core`) | injected at build by Vite (`__APP_VERSION__`) |
| `apps/seeder` | `apps/seeder/package.json` | `/health` reports it as `version`; the Dockerfile carries a `LABEL version` |

## Lock the version

A version is two fields that must agree, or the release lies about itself:

1. `package.json` → `version`
2. the lockfile root → `version` and `packages[""].version` (web and seeder use
   npm lockfiles; admin uses yarn 4, which does not record it)

There is no third copy. `apps/web/src/constants/version.ts` imports the version
from `package.json`, so the number in the header, the about page and the build is
the same number — bumping the package is the whole job.

## Tag

Tags are prefixed by app from 1.3.2 onwards:

```bash
git tag -a web-v1.3.2   -m "web 1.3.2 — …"
git tag -a admin-v1.23.1 -m "Tilawa Admin 1.23.1 — …"
git tag -a seeder-v1.3.2 -m "seeder 1.3.2 — …"
```

A repo release is tagged with the root version and no prefix: `v1.4.0`. It marks
the commit that carries all three app versions listed above; the per-app tags
still point at the commits that actually changed each app.

Earlier tags are plain `v1.x` and are therefore ambiguous when two apps share a
number — `v1.3.2` is the seeder release, `v1.3.0` the web one. Do not reuse an
existing tag; add the prefix instead.

A `v*` tag on `apps/seeder/**` also publishes the multi-arch image through
`.github/workflows/publish-seeder.yml`, in addition to `:latest` and `:sha`.

## Order

```bash
# 1. version + lockfile agree, code committed
# 2. build it, or the tag points at something that never compiled
yarn workspace @tilawa-admin/web build
( cd apps/web && npm run build )

# 3. commit, tag, push
git commit -am "chore(release): <app> <version>"
git tag -a <app>-v<version> -m "<app> <version> — <one line>"
git push origin develop
git checkout main && git merge --ff-only develop && git push origin main
git checkout develop
git push origin <app>-v<version>

# 4. deploy every service whose code changed
docker compose up -d --build web          # or admin-web, admin-api, seeder
```

`develop` and `main` are kept identical: `main` is fast-forwarded, never merged
into by hand, so `git rev-list --count main..develop` is 0 between releases.

## Deploying from a working tree

Every deploy here builds the working tree, not a commit. That makes it easy to
ship something the repository does not have — commit before deploying, and check
`git status` when a running node reports a version you cannot find a tag for.
