# BigQuery Release Notes

A lightweight web app that fetches Google BigQuery's official release notes from the live Atom feed and presents them in a clean, modern dark-themed UI — with type-categorised cards and one-click sharing to X (Twitter).

![Python](https://img.shields.io/badge/Python-3.9%2B-blue?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0%2B-black?logo=flask)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- 📡 **Live feed** — pulls directly from the official BigQuery Atom/XML feed
- 🏷️ **Typed updates** — entries split into categorised cards: `Feature`, `Fix`, `Breaking Change`, `Deprecated`, `Security`, and more
- 🎨 **Modern UI** — dark glassmorphism design with shimmer skeleton loader and hover animations
- 🔄 **Manual refresh** — re-fetch the latest notes on demand
- 🐦 **Share on X** — pre-drafted tweet with smart 280-character budgeting
- 🔒 **XSS-safe** — allowlist-based HTML sanitiser on all feed content
- 📱 **Responsive** — mobile-friendly layout down to 320px

---

## 🗂️ Project Structure

```
bq-releases-notes/
├── app.py                  # Flask server — routes, XML parser, HTML stripper
├── requirements.txt        # Python dependencies
├── templates/
│   └── index.html          # Jinja2 HTML shell
└── static/
    ├── css/
    │   └── style.css       # Design system, animations, component styles
    └── js/
        └── app.js          # Frontend logic — fetch, render, tweet modal
```

---

## 🚀 Getting Started

### Prerequisites

- Python **3.9+**
- `pip`

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/bq-releases-notes.git
cd bq-releases-notes

# 2. Create and activate a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate      # macOS / Linux
.venv\Scripts\activate         # Windows

# 3. Install dependencies
pip install -r requirements.txt
```

### Running locally

```bash
python app.py
```

Open your browser at **http://localhost:5000**

---

## 🔌 API Reference

### `GET /`
Serves the main HTML page.

---

### `GET /api/releases`

Fetches and parses the BigQuery Atom feed, returning structured JSON.

**Success response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "feed_title": "BigQuery release notes",
    "feed_updated": "2026-06-10T00:00:00+00:00",
    "entries": [
      {
        "title": "June 10, 2026",
        "updated": "2026-06-10T00:00:00+00:00",
        "id": "https://cloud.google.com/bigquery/docs/release-notes#June_10_2026",
        "link": "https://cloud.google.com/bigquery/docs/release-notes#June_10_2026",
        "html_content": "<h3>Feature</h3><p>...</p>",
        "plain_text": "Feature BigQuery Omni now supports ...",
        "updates": [
          {
            "type": "Feature",
            "body": "BigQuery Omni now supports ...",
            "entry_title": "June 10, 2026",
            "entry_link": "https://cloud.google.com/..."
          }
        ]
      }
    ]
  }
}
```

**Error responses:**

| Status | Cause |
|--------|-------|
| `502` | Failed to reach the Google feed (network / timeout) |
| `500` | Malformed XML returned from the feed |

---

## 🏗️ How It Works

```
Browser → GET /api/releases → Flask
                                └─▶ requests.get(Atom feed XML from Google)
                                        └─▶ parse_feed()
                                                ├─▶ ET.fromstring()       XML parsing
                                                ├─▶ _parse_updates()      <h3> section splitting
                                                └─▶ strip_html()          plain text extraction
                                └─▶ JSON response
Browser renders release cards via app.js
```

1. **Server** fetches the raw Atom XML from Google Docs
2. `parse_feed()` walks every `<entry>` and extracts metadata + raw HTML content
3. `_parse_updates()` splits each entry's HTML on `<h3>` headings to produce typed update blocks
4. **Client** `app.js` calls `/api/releases`, builds DOM cards, and applies color-coded type badges
5. Clicking a tweet button opens a pre-drafted X intent URL with smart character trimming

---

## 🎨 Update Type Badges

| Badge | Colour | Mapped types |
|-------|--------|-------------|
| Feature | 🟢 Green | `feature` |
| Fix | 🟠 Orange | `fix` |
| Deprecated | 🟣 Purple | `deprecated` |
| Breaking Change | 🔴 Red | `breaking change` |
| Security | 🔵 Cyan | `security` |
| Issue | 🔴 Rose | `issue` |
| Update | ⚪ Muted | everything else |

---

## 🔒 Security Notes

- All HTML content from the feed is passed through a **DOM-based allowlist sanitiser** (`sanitizeContent()` in `app.js`) before being inserted into the page
- Only these tags are allowed: `p`, `a`, `strong`, `em`, `code`, `ul`, `ol`, `li`, `br`, `h3`, `h4`, `b`, `i`, `pre`
- All attributes are stripped except `href` on `<a>` tags, which must begin with `https://` or `http://`
- External links are automatically given `target="_blank" rel="noopener noreferrer"`

---

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `flask` | >=3.0.0 | Web framework and template engine |
| `requests` | >=2.31.0 | HTTP client for fetching the Atom feed |

Stdlib (no install needed): `xml.etree.ElementTree`, `html.parser`, `re`

---

## 🛠️ Development

### Running with auto-reload

The app runs in `debug=True` mode by default when launched via `python app.py`, so Flask will automatically reload on file changes.

### Running in production

Use a production WSGI server such as [Gunicorn](https://gunicorn.org/):

```bash
pip install gunicorn
gunicorn -w 2 -b 0.0.0.0:8080 app:app
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙏 Acknowledgements

- Release notes sourced from the [Google BigQuery documentation](https://cloud.google.com/bigquery/docs/release-notes)
- UI typeface: [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts
