# Contributing a community plugin

Community plugins are third-party code. A catalog listing means the source was reviewed at a point in time; it is not a guarantee that the code is harmless.

## Required layout

```
community-plugins/
  catalog.json
  plugins/
    example-plugin/
      index.ts
      ...source files...
```

A catalog entry must have this shape:

```json
{
  "id": "example-plugin",
  "name": "Example Plugin",
  "description": "What it does",
  "authors": ["Author"],
  "version": "1.0.0",
  "commit": "FULL_40_CHARACTER_COMMIT_SHA",
  "entry": "index.ts",
  "files": [
    {
      "path": "index.ts",
      "sha256": "64_CHARACTER_LOWERCASE_SHA256"
    }
  ]
}
```

The commit must be the exact commit containing the reviewed source. Hashes are calculated from the exact UTF-8 file bytes. Use only source files accepted by the community importer: `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, and `.json`.

## Before opening a pull request

- Keep the plugin focused and explain every permission-sensitive behavior.
- Include readable source; do not submit minified or generated bundles.
- Do not collect, transmit, or store credentials, tokens, personal data, or message content without a clear, necessary, disclosed purpose.
- Do not add remote code execution, obfuscated code, hidden persistence, or unrelated network endpoints.
- Do not include Node/Electron main-process modules; community plugins run in the Discord renderer.
- Include a clear description, author attribution, version, and reproducible source hashes.
- Test against the current SaudiCord build and document known limitations.

## Maintainer review checklist

- Read every submitted source file and inspect its full dependency chain.
- Check network destinations, data collection, storage, event listeners, DOM access, and account/session access.
- Check for obfuscation, dynamic code execution, credential access, hidden behavior, and suspicious encoded payloads.
- Confirm the catalog commit and SHA-256 hashes match the reviewed tree.
- Run the automated checks, then approve manually. A green workflow is not a security approval.

Plugins are still third-party code after review. Users must see the source, publisher, version, and a warning before installing or enabling one.
## Runtime security gate

The desktop importer performs a second static inspection before accepting local source. Direct credential-access patterns, dynamic execution, and native-process imports are blocking findings; network calls and obfuscation indicators are warnings. The scanner is intentionally conservative and can produce false positives or miss behavior hidden through indirection. It is not a sandbox or a security guarantee. Remote catalog installation is implemented in the desktop app: it fetches only from the fixed SaudiCord repository, pins every source file to a full commit, verifies per-file SHA-256, and then uses the same importer and runtime scanner. Catalog installs remain disabled until the user explicitly enables them.
