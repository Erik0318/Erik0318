# Profile statistics

The README uses generated SVGs committed to this repository. GitHub serves the last successful snapshot even when its API or Actions is unavailable. The charts are custom code; the snake uses the same [Platane/snk](https://github.com/Platane/snk) solver as the reference profile, with a custom palette. A Visitor Badge profile-view counter records page hits through GitHub's image proxy and cannot distinguish unique visitors. No personal access token or npm installation is required.

## Update

GitHub Actions refreshes all charts, statistics, releases, and the snake **every six hours**, at 05:23, 11:23, 17:23, and 23:23 PDT (04:23, 10:23, 16:23, and 22:23 PST). Relevant pushes to this profile repository also refresh them. Run an immediate update through **Actions → Refresh profile → Run workflow**. Changes in other repositories are picked up by the next scheduled run. Scheduled runs may be delayed by GitHub; the timestamp below the stats shows the last successful collection.

To refresh locally, install Node.js 22 and GitHub CLI, authenticate with `gh auth login`, and run:

```sh
node scripts/profile.mjs --refresh
node scripts/snake.mjs
```

To rebuild offline from the saved snapshot:

```sh
node scripts/profile.mjs
node scripts/profile.mjs --check
node --test scripts/*.test.mjs
```

Edit `profile.config.json` for the username, selected projects, and language exclusions. Edit the README outside its `profile:start` / `profile:end` markers for the introduction and layout. Generated files should be rebuilt with the script.

The profile itself contains animated vector project tiles, the snake, and charts. Project descriptions, releases, and detailed tables are generated into [activity.md](./activity.md), linked as **Data** below the graphics. No photos or raster illustrations are used. Each project tile links to its repository and has a text alternative; its decorative animation also respects reduced motion.

## What is measured

Displayed timestamps and repository/release dates use Pacific time (`America/Los_Angeles`), automatically switching between PST and PDT. Stored API timestamps retain their original ISO format. GitHub supplies contribution totals in date-only calendar buckets without individual event timestamps; those dates, weekday groupings, and streaks are preserved rather than relabeled as Pacific activity.

- **Contributions:** GitHub's contribution calendar over 365 GitHub calendar dates, including today. Commit, issue, pull request, and review counts come from the same collection. GitHub's contribution eligibility rules apply; these are not a count of every commit on every branch.
- **Streaks:** consecutive GitHub calendar dates with contributions, limited to the displayed year. A zero-count today does not end yesterday's streak until the day is over. A gap yesterday resets it to zero.
- **Active days:** dates with at least one contribution. Best day is the largest daily contribution count in the same window.
- **Stars and repositories:** all public, owned, non-fork repositories, with repository pagination. Archived repositories remain in these counts.
- **Languages:** code bytes returned by GitHub for public, owned, non-fork, non-archived repositories. Profile repositories are excluded so the generator does not distort the result. The largest five languages are shown separately; the rest are grouped under Other. This measures repository composition, not personal expertise or time spent coding.
- **Weekly rhythm:** all contribution types aggregated by GitHub calendar weekday, not hours worked.
- **Contribution history:** contributions grouped into Monday–Sunday GitHub calendar weeks, including partial weeks at the beginning and end of the year. The line and area share the same totals as the headline count.
- **Language doughnut:** the same byte weights as the text language breakdown. The centre identifies the largest language; subtle entrance animation respects reduced motion.
- **Repository language bars:** the five largest eligible repositories by code size. Each bar is normalized to its own repository size and colored by the same legend as the doughnut. The number at the right is thousands of bytes, not lines of code or hours spent.
- **Contribution snake:** the Platane solver computes a path through the account's contribution calendar and outputs a looping SVG in both themes. Cells disappear as the snake eats them. Its calendar uses the upstream solver's GitHub query and may differ slightly at year boundaries from the explicit 365-date stats window.
- **Recent repositories:** the most recent push timestamps, excluding profile repositories. Push time is not necessarily a human-authored commit.
- **Releases:** the most recent stable public release returned for each repository, sorted by publication date.

The workflow uses the repository-scoped `GITHUB_TOKEN`. It does not require access to other private repositories. GitHub controls which contributions are visible to the calling token; local credentials can produce different contribution totals from Actions. The snapshot only stores fields explicitly selected by the query, including public repository metadata and aggregate activity, never tokens, email addresses, or private repository names.

## Rendering and reliability

Project cards animate directly inside the GitHub README. Their diagrams explain an audio timeline with chapters, simplified CPU instruction flow, the path from CSV to film analytics, and the same clip playing at two speeds. These are labeled illustrations, not screenshots, live usage metrics, or exact hardware schematics. Each card includes a description and stack and links to its repository. Native expandable sections reveal snapshot-backed release information and the contribution calendar in place. No separate site or JavaScript is needed; reduced-motion preferences show meaningful static diagrams.

Four dashboard SVGs cover light/dark themes and desktop/mobile widths, with two additional theme-specific snake SVGs. GitHub's native `<picture>` element selects the appropriate asset. Mobile stacks charts vertically with readable labels. SVG titles and descriptions plus the expandable text stats provide text alternatives. Reduced-motion preferences stop chart animations and show the snake as a static contribution calendar. No JavaScript runs in the README.

The snake generator downloads the SVG-only action bundle pinned to commit `d8f6715049803e982ee5ff501b6b9b7d5deeb09b`, runs it in a temporary directory, validates both themes, and then publishes the results. The GitHub token is passed only through the child process environment. Temporary bundles are removed afterwards. Upstream provenance remains embedded in each SVG.

API errors, partial responses, missing projects, incomplete calendars, and inconsistent totals abort generation before outputs are replaced. Each file is written through a temporary file and renamed. The workflow only commits after the whole update and consistency check succeed, so failed runs preserve the published version. Writes are scoped to generated files, jobs are serialized, and a concurrent human push causes a normal push failure rather than a force push.

GitHub may cache image responses, so updated stats can take a little time to appear. A profile README appears on your account when these files are in the public `Erik0318/Erik0318` repository; this repository can also render the README normally.

References: [GitHub GraphQL API](https://docs.github.com/en/graphql), [contribution rules](https://docs.github.com/en/account-and-profile/concepts/contributions-visible-on-your-profile), [workflow scheduling](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
