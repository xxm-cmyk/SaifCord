# SaifCord Community Plugin Catalog

This directory is the source of truth for community plugins distributed by SaifCord.

- `catalog.json` lists only plugins that have passed automated checks and a human review.
- Each plugin lives in its own directory under `plugins/<plugin-id>/`.
- The catalog pins every release to a commit and records SHA-256 hashes for every source file.
- An entry is not an endorsement or a security guarantee. Plugins run with the privileges of the Discord renderer.

## Review and release flow

1. Submit a pull request adding the plugin source under `plugins/<plugin-id>/` and a catalog entry.
2. Automated checks validate the schema, paths, source limits, file hashes, and a set of high-risk patterns.
3. A maintainer reviews the complete source, dependencies, permissions, and behavior. Automated checks do not replace this review.
4. Only after approval and merge should the entry appear in the public catalog.

Do not add compiled bundles, minified code, binaries, archives, symlinks, secrets, tokens, or files outside the accepted source extensions.

See [CONTRIBUTING.md](../.github/COMMUNITY_PLUGINS_CONTRIBUTING.md) for the submission format and review checklist.
## Runtime import checks

The desktop importer runs an additional static inspection before accepting a local community plugin. Credential-access, dynamic-code-execution, and native-process patterns block import. Network and obfuscation patterns are reported as warnings for the user to review. This is not a sandbox, does not prove code is safe, and cannot replace source review. Desktop catalog installation is wired through the verified import pipeline: fixed repository host, pinned commit, per-file SHA-256, the same local validation and scanner, and disabled-by-default state.
