# Hollywood Animal Campaign Desk

Campaign Desk is an unofficial companion for planning film campaigns in Hollywood Animal. It ranks advertisers, shows which audiences and holidays fit your film, and estimates how many extra screenings to book each week.

## Plan a campaign

1. Add your film's tags under **Story elements**, or select **Try an example** to see a sample campaign.
2. Enter the film's **Commercial** and **Artistic** scores. If you select multiple genres, set their relative weights.
3. Check **Advertiser picks** for ranked agencies. Open **Campaign breakdown** for audience matches, holiday bonuses, and suggested campaign timing.
4. Enter **Owned screenings** to see how many extra screenings to book each week.

Your film is saved in your browser. Select **Clear film** to start over.

## Run locally

Open `index.html` in a browser. No build step, server, or account is required. Full styling needs an internet connection to load Tailwind Play CDN from jsDelivr.

## Lint JavaScript

With Node.js and npm installed, run this from the project folder:

```sh
npx --yes oxlint@1.94.0 --max-warnings 0 app.js planner.js guide-data.js
```

Linting runs locally. GitHub Pages serves the static files directly.

## Host on GitHub Pages

Put the project files and the `assets/` folder at the root of your repository. In **Settings → Pages**, choose **Deploy from a branch**, then select your branch and **/(root)**. [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## License

The code is licensed under GPL-3.0. The datasets were condensed and the planner was adapted into a separate site on November 20, 2026. Hollywood Animal is by Weappy. [License](LICENSE)
