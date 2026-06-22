# PR Nutrition Examples

This directory contains snapshots and sample outputs generated from controlled fixture repositories or dogfood runs using the `pr-nutrition` CLI.

## How to Regenerate Examples

If the core analyzer or renderers have been modified, you can regenerate these examples by running the built-in script from the workspace root:

```bash
node scripts/generate-examples.mjs
```

This script creates a temporary Git repository, stages a realistic pull request, and runs the local `pr-nutrition` CLI against it to produce standard Markdown and JSON label formats. No `.git` or arbitrary test repos are committed here.
