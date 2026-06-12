# runheimdall.dev/install — which redirect artifact to apply

The vanity URL `https://runheimdall.dev/install` is a **302** (temporary redirect)
to the pinned release tag's raw `install.sh`:

```
https://raw.githubusercontent.com/randomittin/heimdall/<TAG>/install.sh
```

302, not 301 — the target tag moves every release, so the redirect must never be
cached as permanent. `release/sync-release.sh <TAG>` keeps both artifacts below
pointed at the current tag; deploy whichever one matches the host.

The current hosting provider for `runheimdall.dev` is not yet decided in this repo,
so BOTH artifacts are maintained. Apply exactly one:

| Host | File | Notes |
| --- | --- | --- |
| **Vercel** | `/vercel.json` (repo root) | `redirects[].permanent = false` ⇒ 307/302 temporary. Vercel reads `vercel.json` at the deploy root. |
| **Netlify** | `/_redirects` (repo root) | The explicit trailing `302` overrides Netlify's 301 default. Place at the publish dir root. |

Pick the file for your host; the other is harmless but unused. If `runheimdall.dev`
is served some other way (Cloudflare Pages reads `_redirects` too; a plain nginx/
Caddy host needs a hand-written rule), mirror the same `/install → <TAG> raw URL`,
**302** mapping there and update this table.

## Verify after deploy

```
curl -sI https://runheimdall.dev/install
# HTTP/2 302
# location: https://raw.githubusercontent.com/randomittin/heimdall/<TAG>/install.sh
```

DNS and hosting deploys are RJ-EXECUTED — see `release/publish-checklist.md` step 4.
