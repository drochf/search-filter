# search-filter

A Violentmonkey userscript that strips Google search down to plain links and
keeps news headlines out of the results.

## What it does

- Opens searches in Google's plain **Web** mode, and cleans up **All**: no AI
  overview, Top stories, videos, "People also ask", ads or thumbnails.
- Replaces Google's tabs with **All · Web · Images · Maps**. The News, AI Mode
  and Videos tabs send you back to Web.
- Hides news results:
  - any site listed in [`blocked-sites.txt`](blocked-sites.txt)
  - results whose site name or link says "News" (e.g. "YouTube · BBC News")
  - results dated within the last 30 days, or stamped "X hours/days ago"

## Install

1. Install the [Violentmonkey](https://violentmonkey.github.io/) extension in Chrome.
2. In `chrome://extensions` → Violentmonkey → Details, turn on **Allow user scripts**.
3. Open the [script file](https://raw.githubusercontent.com/drochf/search-filter/main/google-clean-search.user.js)
   and click **Install**.

## Blocking another site

1. Open [`blocked-sites.txt`](blocked-sites.txt) on GitHub and click the pencil icon.
2. Add the site on its own line, e.g. `example.com`. Subdomains are covered
   automatically, and pasting a full link works too.
3. Click **Commit changes**.

Your browser picks up the change within about 3 hours. Script updates are
picked up by Violentmonkey automatically (about once a day).
