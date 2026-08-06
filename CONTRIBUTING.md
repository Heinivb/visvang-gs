# Contributing

Thanks for taking a look at this project. It's a small personal Google Apps
Script web app for tracking fishing gear inventory and logged catches, bound
to a Google Sheet — so the workflow is a little different from a typical
npm-based repo.

## Project structure

```
scripts/
  Code.gs          Server-side Apps Script (reads/writes the bound Google Sheet)
  Index.html       Page markup (HtmlService template)
  JavaScript.html  Client-side JS (all UI logic, calls Code.gs via google.script.run)
  Stylesheet.html  CSS
```

`Index.html` pulls in `Stylesheet.html` and `JavaScript.html` via Apps
Script's `<?!= include('...'); ?>` templating — there's no separate build
step or bundler.

## Setting up a dev copy

This repo isn't wired up with `clasp` yet. To try changes against a real
sheet:

1. Make a copy of the target Google Sheet (or create a new one with the
   same tab layout — see the header comment at the top of `Code.gs` for the
   expected sheet/column layout).
2. In the Sheet, go to **Extensions → Apps Script**.
3. Copy the contents of `scripts/Code.gs`, `scripts/Index.html`,
   `scripts/JavaScript.html`, and `scripts/Stylesheet.html` into matching
   files in the Apps Script editor (create the `.html` files there if they
   don't exist yet).
4. **Deploy → Test deployments** (or **New deployment → Web app**) to run
   it in a browser.
5. If you're testing photo uploads, set a Drive folder on the Settings tab
   first — the first Drive write will prompt for authorization.

If you'd rather work with `clasp` locally, that's welcome as a contribution
too (a `.clasp.json` + `appsscript.json` PR), just flag it as infra so it's
reviewed as a project change rather than a feature.

## Making changes

- Keep `Code.gs` functions that are only called internally (not exposed to
  the client) named with a trailing underscore (`someHelper_`) — that's the
  existing convention and makes the client-callable surface easy to spot.
- Match the existing JSDoc style on functions you touch or add (`@param`,
  `@return`), and prefer a short comment explaining *why* over restating
  *what* the code does.
- CSS uses the custom properties defined at the top of `Stylesheet.html`
  (`--color-*`, `--radius-*`, `--shadow-card`) — reuse those rather than
  hardcoding colors/spacing.
- There's no automated test suite. Test changes by running the app in a
  browser against real (or copy) sheet data — see "Setting up a dev copy"
  above. For UI changes, check both desktop and a narrow/mobile viewport.

## Submitting changes

1. Open an issue first for anything non-trivial, using the bug report or
   feature request template, so the approach can be discussed before you
   invest time.
2. Keep PRs focused — one fix or feature per PR is easier to review than a
   bundle of unrelated changes.
3. Fill out the PR template, including how you tested the change.
4. Don't include real spreadsheet data, Drive folder IDs, or other personal 
   details in commits, screenshots, or issue reports.

## Reporting bugs / security issues

- Regular bugs and feature ideas: open a GitHub issue using the provided
  templates.
- Security issues: see [SECURITY.md](SECURITY.md) — please report those
  privately rather than as a public issue.
