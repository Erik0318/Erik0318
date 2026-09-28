# Profile statistics

The README uses locally generated SVGs. GitHub serves the last successful snapshot even when its API or Actions is unavailable. No external image service, tracking pixel, personal access token, or npm package is required.

## Update

GitHub Actions refreshes the data daily at 06:23 UTC, on relevant pushes, or through **Actions → Refresh profile → Run workflow**. Scheduled runs may be delayed by GitHub. The date printed on every dashboard shows when its data was collected.

To refresh locally, install Node.js 22 and GitHub CLI, authenticate with `gh auth login`, and run:

```sh
node scripts/profile.mjs --refresh
```

To rebuild offline from the saved snapshot:

```sh
node scripts/profile.mjs
node scripts/profile.mjs --check
node --test scripts/profile.test.mjs
```

Edit `profile.config.json` for the username, selected projects, and language exclusions. Edit the README outside its `profile:start` / `profile:end` markers for the introduction and layout. Generated files should be rebuilt with the script.

## What is measured

- **Contributions:** GitHub's contribution calendar over 365 UTC dates, including today. Commit, issue, pull request, and review counts come from the same collection. GitHub's contribution eligibility rules apply; these are not a count of every commit on every branch.
- **Streaks:** consecutive UTC calendar dates with contributions, limited to the displayed year. A zero-count today does not end yesterday's streak until the day is over. A gap yesterday resets it to zero.
- **Active days:** dates with at least one contribution. Best day is the largest daily contribution count in the same window.
- **Stars and repositories:** all public, owned, non-fork repositories, with repository pagination. Archived repositories remain in these counts.
- **Languages:** code bytes returned by GitHub for public, owned, non-fork, non-archived repositories. Profile repositories are excluded so the generator does not distort the result. The largest five languages are shown separately; the rest are grouped under Other. This measures repository composition, not personal expertise or time spent coding.
- **Weekly rhythm:** all contribution types aggregated by UTC weekday, not hours worked.
- **Recent repositories:** the most recent push timestamps, excluding profile repositories. Push time is not necessarily a human-authored commit.
- **Releases:** the most recent stable public release returned for each repository, sorted by publication date.

The workflow uses the repository-scoped `GITHUB_TOKEN`. It does not require access to other private repositories. GitHub controls which contributions are visible to the calling token; local credentials can produce different contribution totals from Actions. The snapshot only stores fields explicitly selected by the query, including public repository metadata and aggregate activity, never tokens, email addresses, or private repository names.

## Rendering and reliability

Four SVGs cover light/dark themes and desktop/mobile widths. GitHub's native `<picture>` element selects the appropriate asset. Mobile uses a legible 26-week calendar; headline totals and streaks still cover the full year. SVG titles and descriptions plus the expandable text stats provide text alternatives. A short entrance fade respects reduced-motion preferences; no JavaScript runs in the README.

API errors, partial responses, missing projects, incomplete calendars, and inconsistent totals abort generation before outputs are replaced. Each file is written through a temporary file and renamed. The workflow only commits after the whole update and consistency check succeed, so failed runs preserve the published version. Writes are scoped to generated files, jobs are serialized, and a concurrent human push causes a normal push failure rather than a force push.

GitHub may cache image responses, so updated stats can take a little time to appear. A profile README appears on your account when these files are in the public `Erik0318/Erik0318` repository; this repository can also render the README normally.

References: [GitHub GraphQL API](https://docs.github.com/en/graphql), [contribution rules](https://docs.github.com/en/account-and-profile/concepts/contributions-visible-on-your-profile), [workflow scheduling](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
