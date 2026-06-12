# runheimdall

The npm-native door to [Heimdall](https://github.com/randomittin/heimdall) — *Nothing ships unproven.*

```
npx runheimdall
```

This is a thin wrapper. It does exactly three things:

1. **Fetches** the `install.sh` pinned to this package's release tag — the *same* script that
   `curl -fsSL https://runheimdall.dev/install | bash` runs (the redirect's 302 target).
2. **Verifies** its `sha256` against a checksum baked into this package at publish time. The bytes
   are buffered, hashed, and compared *before* anything executes. A mismatch — tampered CDN, wrong
   tag, truncated download — aborts before a single line runs.
3. **Runs** the verified script with `bash`, forwarding your arguments and exit code.

The wrapper version is locked to a Heimdall release tag: every Heimdall release publishes a new
`runheimdall` version pinned to that tag, with a freshly captured checksum. What `npx` runs is
byte-identical to what the redirect serves and to what a skeptic reads with `less install.sh`.

## Prefer to read it first?

```
curl -fsSL https://raw.githubusercontent.com/randomittin/heimdall/v1.1.0/install.sh -o install.sh
less install.sh        # short, function-wrapped, no sudo, no prompts, no telemetry
bash install.sh
```

## Environment overrides (for testing / development)

| Variable | Purpose |
| --- | --- |
| `RUNHEIMDALL_INSTALL_SCRIPT` | Use a local file's bytes instead of fetching. The sha256 assertion still runs against them. |
| `RUNHEIMDALL_SHA256` | Override the expected checksum (hex, 64 chars). |
| `RUNHEIMDALL_INSTALL_URL` | Override the fetch URL. |
| `RUNHEIMDALL_TAG` | Override the displayed tag. |

The installer's own `HEIMDALL_*` env vars (`HEIMDALL_REF`, `HEIMDALL_REPO`, `HEIMDALL_NO_COLOR`, …)
pass straight through to the script.

MIT. No telemetry. No network calls home. Read the source — it's one file.
