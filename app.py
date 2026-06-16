from flask import Flask, jsonify, render_template
import requests
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
import re

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
ATOM_NS = "http://www.w3.org/2005/Atom"


class HTMLStripper(HTMLParser):
    """Simple HTML tag stripper."""
    def __init__(self):
        super().__init__()
        self.reset()
        self.fed = []

    def handle_data(self, d):
        self.fed.append(d)

    def get_data(self):
        return " ".join(self.fed)


def strip_html(html: str) -> str:
    s = HTMLStripper()
    s.feed(html)
    text = s.get_data()
    # Collapse whitespace
    return re.sub(r"\s+", " ", text).strip()


def parse_feed(xml_text: str) -> dict:
    root = ET.fromstring(xml_text)

    feed_title = root.findtext(f"{{{ATOM_NS}}}title", "BigQuery Release Notes")
    feed_updated = root.findtext(f"{{{ATOM_NS}}}updated", "")

    entries = []
    for entry in root.findall(f"{{{ATOM_NS}}}entry"):
        title = entry.findtext(f"{{{ATOM_NS}}}title", "")
        updated = entry.findtext(f"{{{ATOM_NS}}}updated", "")
        entry_id = entry.findtext(f"{{{ATOM_NS}}}id", "")

        link_el = entry.find(f"{{{ATOM_NS}}}link[@rel='alternate']")
        link = link_el.get("href", "") if link_el is not None else ""

        content_el = entry.find(f"{{{ATOM_NS}}}content")
        html_content = content_el.text if content_el is not None else ""
        plain_text = strip_html(html_content or "")

        # Parse individual update blocks (h3 headings split the content)
        updates = _parse_updates(html_content or "", title, link)

        entries.append(
            {
                "title": title,
                "updated": updated,
                "id": entry_id,
                "link": link,
                "html_content": html_content,
                "plain_text": plain_text,
                "updates": updates,
            }
        )

    return {
        "feed_title": feed_title,
        "feed_updated": feed_updated,
        "entries": entries,
    }


def _parse_updates(html_content: str, entry_title: str, entry_link: str) -> list:
    """Split entry HTML into individual named updates using h3 as section headers."""
    # Split on <h3> tags
    parts = re.split(r"(<h3>.*?</h3>)", html_content, flags=re.IGNORECASE | re.DOTALL)

    updates = []
    current_type = None
    for part in parts:
        h3_match = re.match(r"<h3>(.*?)</h3>", part, re.IGNORECASE | re.DOTALL)
        if h3_match:
            current_type = strip_html(h3_match.group(1))
        elif part.strip() and current_type:
            body_plain = strip_html(part)
            if body_plain:
                updates.append(
                    {
                        "type": current_type,
                        "body": body_plain,
                        "entry_title": entry_title,
                        "entry_link": entry_link,
                    }
                )

    # If no h3 sections found, treat whole content as one update
    if not updates and html_content:
        plain = strip_html(html_content)
        if plain:
            updates.append(
                {
                    "type": "Update",
                    "body": plain,
                    "entry_title": entry_title,
                    "entry_link": entry_link,
                }
            )

    return updates


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/releases")
def releases():
    try:
        resp = requests.get(FEED_URL, timeout=15)
        resp.raise_for_status()
        data = parse_feed(resp.text)
        return jsonify({"success": True, "data": data})
    except requests.RequestException as e:
        return jsonify({"success": False, "error": str(e)}), 502
    except ET.ParseError as e:
        return jsonify({"success": False, "error": f"XML parse error: {e}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
