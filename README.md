# Night edition

A dark, minimal reader for The Guardian, built on the [Guardian Open Platform](https://open-platform.theguardian.com/) API.

Static HTML, CSS and JavaScript. No build step, no dependencies, no server.

**Live:** https://pnettto.github.io/night-edition/

## Features

- Cover page with editors' picks for headlines, opinion, sport, culture, lifestyle, environment, business and technology
- Full article view with reading progress
- Edition choice: International, Europe, UK, US, Australia
- Adjustable article text size
- Installable on mobile home screens

## Usage

1. Get a free developer key at <https://open-platform.theguardian.com/access/>.
2. Open the app and paste the key in Settings. It is stored only in your browser's `localStorage`.

## Run locally

Serve the directory with any static server, for example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Structure

```
index.html            markup and entry point
src/style.css         styles
src/app.js            API client, routing and views
manifest.webmanifest  web app manifest
icon.svg              app icon
```

## Notes

Content is fetched directly from the Guardian API and remains subject to its [terms](https://www.theguardian.com/open-platform/terms-and-conditions). This project is not affiliated with The Guardian.

## License

[MIT](LICENSE)
