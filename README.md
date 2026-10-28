# Violet Source

Violet Source lets you request a Chrome Web Store extension package in **CRX** format or extract its ZIP payload for inspection and learning.

## Features

- Optional light theme
- Detects extension IDs from supported Chrome Web Store links
- Download package as `.crx` or extract the ZIP payload as `.zip`
- Progress and status feedback
- Manifest V3 service worker

## Install locally

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the `violet-source` project folder (the folder containing `manifest.json`).

## Use

1. Open a Chrome Web Store extension detail page, or copy its URL.
2. Open Violet Source.
3. Check the detected extension ID.
4. Choose **Download CRX** or **Download ZIP**.

## Important notes

- Downloads depend on Google's update service and may fail if an extension is unavailable or the service changes.
- ZIP extraction supports CRX2 and CRX3 package headers.
- Chrome permissions and clipboard behavior can vary by browser version. If the Paste button is blocked, use `Ctrl+V` in the URL field.
- The project does not upload your pasted URL to a third-party server; requests go to Google's extension update service.

## Project structure

```text
violet-source/
├── background.js
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── icons/
│   ├── 16.png
│   ├── 32.png
│   ├── 48.png
│   └── 128.png
├── README.md
├── LICENSE
└── .gitignore
```

## License

MIT. See [LICENSE](LICENSE).
