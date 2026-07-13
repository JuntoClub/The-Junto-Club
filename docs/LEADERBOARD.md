# Gold Coin Leaderboard

The public leaderboard lives at `/leaderboard`. Printed cards should always use the QR URL:

```text
https://juntoclubco.com/gold
```

`/gold` redirects to the current leaderboard. This site is temporary; when the leaderboard moves to the future Astro site, update only the `/gold` redirect so printed cards keep working.

## Update Gold Counts

1. Open the Google Sheet that feeds the leaderboard.
2. Keep the columns exactly `username` and `gold`.
3. Edit collector usernames and gold counts.
4. Leave blank rows empty; the sync skips them.

Gold counts must be non-negative whole numbers. Duplicate usernames make the sync fail on purpose.

## Push Changes Live

1. Go to GitHub.
2. Open Actions.
3. Choose the `Sync Leaderboard` workflow.
4. Click `Run workflow`.
5. The Action reads the published CSV, updates `data/leaderboard.json`, regenerates rows in `leaderboard.html`, and commits changes to `main`.
6. Netlify rebuilds from the commit to `main`.

The workflow also runs once daily as a safety net. Manual runs are the primary path during shows.

Changes usually appear after the GitHub Action finishes and Netlify completes its deploy. Expect a few minutes end to end.

## CSV Secret

The published Google Sheet CSV URL lives in the GitHub repository secret named `LEADERBOARD_CSV_URL`.

To rotate it:

1. Publish the replacement sheet or tab as CSV.
2. Copy the public CSV URL.
3. In GitHub, open Settings, then Secrets and variables, then Actions.
4. Update `LEADERBOARD_CSV_URL`.
5. Run the `Sync Leaderboard` workflow manually.

## Goal

The redemption goal is stored in `data/leaderboard.json` as `goal`. The sync preserves the existing value unless `LEADERBOARD_GOAL` is set for the workflow run.

## Manual Fallback

If the Action breaks during a show:

1. Edit `data/leaderboard.json` directly.
2. Edit the table rows in `leaderboard.html` between `<!-- LEADERBOARD:START -->` and `<!-- LEADERBOARD:END -->`.
3. Keep the rows sorted by gold descending, then username alphabetically.
4. Update the `Last updated` line in `leaderboard.html`.
5. Commit to `main` so Netlify deploys.

## Why The Sync Commit Must Not Use `[skip ci]`

Do not add `[skip ci]` to the sync commit message. Netlify honors that marker and will skip the rebuild, which means the Action can commit correct leaderboard files while the live site stays stale.

The workflow commit message is intentionally:

```text
chore: sync leaderboard
```
