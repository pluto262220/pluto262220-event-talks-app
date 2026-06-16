/* ============================================================
   BigQuery Release Notes — Frontend Logic
   ============================================================ */

(function () {
  "use strict";

  /* ── DOM refs ── */
  const refreshBtn       = document.getElementById("refresh-btn");
  const spinnerSvg       = document.getElementById("spinner-svg");
  const feedMeta         = document.getElementById("feed-meta");
  const skeletonList     = document.getElementById("skeleton-list");
  const releasesContainer = document.getElementById("releases-container");
  const errorBanner      = document.getElementById("error-banner");
  const errorText        = document.getElementById("error-text");

  /* Modal refs */
  const tweetModal  = document.getElementById("tweet-modal");
  const tweetTextarea = document.getElementById("tweet-text");
  const charCount   = document.getElementById("char-count");
  const tweetLink   = document.getElementById("tweet-link");
  const modalClose  = document.getElementById("modal-close");
  const modalCancel = document.getElementById("modal-cancel");

  /* ── State ── */
  let currentEntryLink = "";

  /* ─────────────────────────────────────────────
     Utilities
  ───────────────────────────────────────────── */
  function setLoading(isLoading) {
    refreshBtn.disabled = isLoading;
    spinnerSvg.classList.toggle("spinning", isLoading);
    skeletonList.classList.toggle("hidden", !isLoading);
    releasesContainer.classList.toggle("hidden", isLoading);
    if (isLoading) {
      errorBanner.classList.add("hidden");
      releasesContainer.innerHTML = "";
    }
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorBanner.classList.remove("hidden");
    skeletonList.classList.add("hidden");
  }

  function formatDate(isoStr) {
    if (!isoStr) return "";
    try {
      return new Date(isoStr).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric"
      });
    } catch {
      return isoStr;
    }
  }

  function typeToCssClass(type) {
    const map = {
      feature:    "type-feature",
      fix:        "type-fix",
      deprecated: "type-deprecated",
      "breaking change": "type-breaking",
      security:   "type-security",
      issue:      "type-issue",
    };
    return map[(type || "").toLowerCase()] || "type-other";
  }

  function truncateForTweet(text, maxLen) {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 1) + "…";
  }

  /* ─────────────────────────────────────────────
     Render
  ───────────────────────────────────────────── */
  function renderReleases(data) {
    const { feed_updated, entries } = data;

    if (feed_updated) {
      feedMeta.textContent = `Updated ${formatDate(feed_updated)}`;
    }

    if (!entries || entries.length === 0) {
      releasesContainer.innerHTML =
        '<p style="color:var(--text-muted);text-align:center;padding:40px 0;">No entries found.</p>';
      return;
    }

    const fragment = document.createDocumentFragment();

    entries.forEach((entry) => {
      const entryDiv = document.createElement("div");
      entryDiv.className = "release-entry";

      /* ── Date header ── */
      const header = document.createElement("div");
      header.className = "entry-header";

      const datePill = document.createElement("span");
      datePill.className = "entry-date-pill";
      datePill.innerHTML = `
        <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
          <path d="M4 1v2M8 1v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M1 5h10" stroke="currentColor" stroke-width="1.2"/>
        </svg>
        ${escapeHtml(entry.title)}`;

      const divider = document.createElement("div");
      divider.className = "entry-divider";

      const linkBtn = document.createElement("a");
      linkBtn.className = "entry-link-btn";
      linkBtn.href = entry.link || "#";
      linkBtn.target = "_blank";
      linkBtn.rel = "noopener noreferrer";
      linkBtn.textContent = "View docs ↗";
      linkBtn.setAttribute("aria-label", `View ${entry.title} docs`);

      header.appendChild(datePill);
      header.appendChild(divider);
      header.appendChild(linkBtn);
      entryDiv.appendChild(header);

      /* ── Update cards ── */
      const updates = entry.updates && entry.updates.length
        ? entry.updates
        : [{ type: "Update", body: entry.plain_text, entry_title: entry.title, entry_link: entry.link }];

      updates.forEach((update, idx) => {
        const card = buildUpdateCard(update, entry, idx);
        entryDiv.appendChild(card);
      });

      fragment.appendChild(entryDiv);
    });

    releasesContainer.appendChild(fragment);
    releasesContainer.classList.remove("hidden");
  }

  function buildUpdateCard(update, entry, idx) {
    const card = document.createElement("article");
    card.className = "update-card";
    card.setAttribute("aria-label", `${update.type} — ${entry.title}`);

    /* Type badge */
    const badge = document.createElement("span");
    badge.className = `update-type ${typeToCssClass(update.type)}`;
    badge.textContent = update.type;

    /* Body */
    const bodyWrap = document.createElement("div");
    bodyWrap.className = "update-body-wrap";

    const body = document.createElement("div");
    body.className = "update-body";
    body.innerHTML = sanitizeContent(update.body || "");

    bodyWrap.appendChild(body);

    /* Tweet button */
    const tweetBtn = document.createElement("button");
    tweetBtn.className = "tweet-btn";
    tweetBtn.setAttribute("aria-label", "Share this update on X");
    tweetBtn.setAttribute("title", "Share on X (Twitter)");
    tweetBtn.id = `tweet-btn-${entry.id?.replace(/[^a-z0-9]/gi, "_")}-${idx}`;
    tweetBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>`;

    tweetBtn.addEventListener("click", () => {
      openTweetModal(update, entry);
    });

    card.appendChild(badge);
    card.appendChild(bodyWrap);
    card.appendChild(tweetBtn);
    return card;
  }

  /* ─────────────────────────────────────────────
     Tweet Modal
  ───────────────────────────────────────────── */
  const MAX_TWEET  = 280;
  // Twitter/X wraps URLs to ~23 chars (t.co). Reserve space + a space.
  const URL_COST   = 24;

  function openTweetModal(update, entry) {
    const link = entry.link || "";
    currentEntryLink = link;

    // Characters available for text (excluding the URL that will be appended)
    const available = MAX_TWEET - URL_COST - (link ? 1 : 0); // 1 for newline/space

    const prefix = update.type !== "Update" ? `[${update.type}] ` : "";
    const dateStr = entry.title ? `(${entry.title}) ` : "";
    const body = update.body || "";

    // Build initial draft
    const header = `BigQuery Release Notes ${dateStr}— ${prefix}`;
    const maxBodyLen = available - header.length - 3; // 3 for " #BigQuery"
    const truncBody = truncateForTweet(body, Math.max(20, maxBodyLen));
    const draft = `${header}${truncBody} #BigQuery`;

    tweetTextarea.value = draft.slice(0, available);
    updateCharCount();
    updateTweetLink();

    tweetModal.classList.remove("hidden");
    tweetTextarea.focus();
    tweetTextarea.setSelectionRange(tweetTextarea.value.length, tweetTextarea.value.length);
  }

  function closeTweetModal() {
    tweetModal.classList.add("hidden");
    tweetTextarea.value = "";
    currentEntryLink = "";
  }

  function updateCharCount() {
    const len = tweetTextarea.value.length;
    charCount.textContent = len;
    charCount.classList.toggle("char-over", len > MAX_TWEET);
  }

  function updateTweetLink() {
    const text = tweetTextarea.value;
    const tweetBody = currentEntryLink
      ? `${text}\n${currentEntryLink}`
      : text;
    tweetLink.href = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetBody)}`;
  }

  tweetTextarea.addEventListener("input", () => {
    updateCharCount();
    updateTweetLink();
  });

  modalClose.addEventListener("click", closeTweetModal);
  modalCancel.addEventListener("click", closeTweetModal);

  tweetModal.addEventListener("click", (e) => {
    if (e.target === tweetModal) closeTweetModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTweetModal();
  });

  /* ─────────────────────────────────────────────
     Fetch
  ───────────────────────────────────────────── */
  async function fetchReleases() {
    setLoading(true);
    try {
      const resp = await fetch("/api/releases");
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const json = await resp.json();
      if (!json.success) throw new Error(json.error || "Unknown error");
      renderReleases(json.data);
    } catch (err) {
      showError(`Failed to load release notes: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  refreshBtn.addEventListener("click", fetchReleases);

  /* ─────────────────────────────────────────────
     Security helpers
  ───────────────────────────────────────────── */
  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Allow a safe subset of HTML from the feed
  function sanitizeContent(html) {
    const ALLOWED_TAGS = /^(p|a|strong|em|code|ul|ol|li|br|h3|h4|b|i|pre)$/i;
    const div = document.createElement("div");
    div.innerHTML = html;

    function clean(node) {
      if (node.nodeType === Node.TEXT_NODE) return;
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (!ALLOWED_TAGS.test(node.tagName)) {
          // Replace disallowed tag with its children
          const frag = document.createDocumentFragment();
          [...node.childNodes].forEach(c => { clean(c); frag.appendChild(c); });
          node.replaceWith(frag);
          return;
        }
        // Strip all attributes except href on <a>
        [...node.attributes].forEach(attr => {
          if (node.tagName.toLowerCase() === "a" && attr.name === "href") {
            // Validate URL scheme
            if (!/^https?:\/\//i.test(attr.value)) node.removeAttribute("href");
            else {
              node.setAttribute("target", "_blank");
              node.setAttribute("rel", "noopener noreferrer");
            }
          } else {
            node.removeAttribute(attr.name);
          }
        });
        [...node.childNodes].forEach(clean);
      }
    }

    [...div.childNodes].forEach(clean);
    return div.innerHTML;
  }

  /* ─────────────────────────────────────────────
     Boot
  ───────────────────────────────────────────── */
  fetchReleases();
})();
