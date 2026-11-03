// ==UserScript==
// @name         Google: Clean Web Results
// @namespace    https://github.com/drochf/search-filter
// @version      3.3
// @description  Forces Google into "Web" mode (udm=14) and hides everything that is not an ordinary result: AI overviews, ads, images, videos, maps, news, "People also ask", related searches. Also hides results from the sites in blocked-sites.txt and anything recently dated, and replaces Google's tab bar with All / Web / Images / Maps.
// @match        https://www.google.com/search*
// @match        https://google.com/search*
// @match        https://www.google.ca/search*
// @match        https://google.ca/search*
// @match        https://www.google.com/
// @match        https://www.google.com/?*
// @match        https://www.google.com/webhp*
// @match        https://www.google.ca/
// @match        https://www.google.ca/?*
// @match        https://www.google.ca/webhp*
// @downloadURL  https://raw.githubusercontent.com/drochf/search-filter/main/google-clean-search.user.js
// @updateURL    https://raw.githubusercontent.com/drochf/search-filter/main/google-clean-search.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @connect      raw.githubusercontent.com
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
    "use strict";

    // ---- 0. Search suggestions (every page, homepage included) ----------
    // The dropdown under the search box ("ukraine war news", trending searches)
    // is hidden, and the arrow keys can't step through it into the box.
    const suggestStyle = document.createElement("style");
    suggestStyle.textContent = `form [role="listbox"] { display: none !important; }`;
    document.documentElement.appendChild(suggestStyle);

    addEventListener("keydown", e => {
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.target.matches?.('form [name="q"]')) {
            e.stopImmediatePropagation();
        }
    }, true);

    // The panel around the list (with its "Report inappropriate predictions"
    // line) is the list's outermost ancestor that doesn't hold the search box.
    function hideSuggestPanel() {
        for (const list of document.querySelectorAll('form [role="listbox"]')) {
            let panel = list;
            while (panel.parentElement && !panel.parentElement.querySelector('[name="q"]')) {
                panel = panel.parentElement;
            }
            panel.style.display = "none";
        }
    }

    if (location.pathname !== "/search") {
        new MutationObserver(hideSuggestPanel).observe(document.documentElement, {
            childList: true,
            subtree: true,
        });
        return;
    }

    // ---- 1. Pick the mode ------------------------------------------------
    // Default is Web mode. News, AI Mode and video tabs are sent to Web too.
    // Our own "All" tab adds clean=all so it is left alone (and pruned below).
    const url = new URL(location.href);
    const params = url.searchParams;
    const udm = params.get("udm"), tbm = params.get("tbm");
    const isAll = params.get("clean") === "all";
    const NEWSY_UDM = ["50", "7", "39", "vids", "short_vids"];   // AI Mode, Videos, Short videos
    const NEWSY_TBM = ["nws", "vid"];                            // News, Videos

    const wantWeb = (!udm && !tbm && !isAll) || NEWSY_UDM.includes(udm) || NEWSY_TBM.includes(tbm);
    if (wantWeb) {
        // Loop guard is time-based: skip only if this exact query was redirected
        // in the last 5 seconds (i.e. Google bounced us back).
        const key = "cleanSearch:" + (params.get("q") || "");
        let last = 0;
        try { last = Number(sessionStorage.getItem(key)) || 0; } catch (e) {}
        if (Date.now() - last > 5000) {
            try { sessionStorage.setItem(key, String(Date.now())); } catch (e) {}
            params.delete("tbm");
            params.delete("clean");
            params.set("udm", "14");
            location.replace(url.toString());
            return;
        }
    }

    const mode = isAll ? "all" : udm === "14" ? "web" : (udm === "2" || tbm === "isch") ? "images" : "other";
    const pruneResults = mode === "all" || mode === "web";

    // ---- 2. CSS: hide known clutter -------------------------------------
    const style = document.createElement("style");
    style.textContent = `
        #cnt [role="navigation"]:not(#botstuff [role="navigation"]),  /* Google's tab bar */
        #appbar
        { display: none !important; }

        #clean-tabs { display: flex; flex-shrink: 0; width: max-content; gap: 22px;
                      padding: 12px 0 10px; font-size: 14px; }
        #clean-tabs a { color: inherit; opacity: .7; text-decoration: none; padding-bottom: 6px; }
        #clean-tabs a:hover { opacity: 1; }
        #clean-tabs a.on { opacity: 1; border-bottom: 3px solid currentColor; }
    ` + (pruneResults ? `
        #rcnt > :not(#center_col),          /* knowledge panel, image/video header */
        #tads, #tadsb, #bottomads,          /* ads */
        #bres,                              /* related searches */
        g-scrolling-carousel, video-voyager, g-section-with-header, g-map,
        [data-news-cluster-id], [data-local-attribute],
        #rso table[role="group"],           /* sitelinks, "More results from ..." */
        #rso img                            /* all thumbnails and favicons */
        { display: none !important; }

        /* Breathing room between the line under the tabs and the first result */
        #rso { margin-top: 24px !important; }
    ` : "");
    document.documentElement.appendChild(style);

    // ---- 3. Our own tab row: All / Web / Images / Maps ------------------
    function addTabs() {
        if (document.getElementById("clean-tabs")) return;
        const nav = [...document.querySelectorAll('#cnt [role="navigation"]')]
            .find(n => !n.closest("#botstuff"));
        if (!nav) return;
        const q = encodeURIComponent(params.get("q") || "");
        const base = location.origin + "/search?q=" + q;
        const tabs = [
            ["All", base + "&clean=all", mode === "all"],
            ["Web", base + "&udm=14", mode === "web"],
            ["Images", base + "&udm=2", mode === "images"],
            ["Maps", "https://www.google.com/maps/search/" + q, false],
        ];
        const bar = document.createElement("div");
        bar.id = "clean-tabs";
        for (const [label, href, on] of tabs) {
            const a = document.createElement("a");
            a.textContent = label;
            a.href = href;
            if (on) a.className = "on";
            bar.appendChild(a);
        }
        nav.parentElement.insertBefore(bar, nav);
        alignTabs();
    }

    // Line the row up with the search box, which sits at the same spot in every mode.
    function alignTabs() {
        const bar = document.getElementById("clean-tabs");
        const box = document.querySelector('form[action="/search"]');
        if (!bar || !box) return;
        const left = box.getBoundingClientRect().left - bar.parentElement.getBoundingClientRect().left;
        bar.style.marginLeft = Math.max(0, left) + "px";
    }
    addEventListener("resize", alignTabs);

    // ---- 4. News results -------------------------------------------------
    // Blocked sites live in blocked-sites.txt in the GitHub repo. Violentmonkey
    // keeps a copy and refreshes it every few hours, so editing the file on
    // GitHub is enough; if GitHub can't be reached the last copy is used.
    const SITES_URL = "https://raw.githubusercontent.com/drochf/search-filter/main/blocked-sites.txt";
    const SITES_MAX_AGE = 3 * 3600e3;
    let blockedSites = [];

    // One site per line, "#" starts a note; full links are cut down to the site.
    function parseSites(text) {
        return text.split("\n")
            .map(line => line.replace(/#.*/, "").trim().toLowerCase())
            .map(s => s.replace(/^[a-z]+:\/\//, "").replace(/[\/?:].*$/, "").replace(/^www\./, ""))
            .filter(Boolean);
    }

    // Script managers differ: Violentmonkey has GM_getValue, Safari's
    // Userscripts app only has the promise-based GM.getValue. Use whichever
    // exists, and the page's own localStorage if neither does.
    const gm = typeof GM === "object" ? GM : {};

    async function load(key, fallback) {
        try {
            if (gm.getValue) return await gm.getValue(key, fallback);
            if (typeof GM_getValue === "function") return GM_getValue(key, fallback);
            const v = localStorage.getItem("cleanSearch:" + key);
            return v === null ? fallback : JSON.parse(v);
        } catch (e) { return fallback; }
    }

    async function save(key, value) {
        try {
            if (gm.setValue) return await gm.setValue(key, value);
            if (typeof GM_setValue === "function") return GM_setValue(key, value);
            localStorage.setItem("cleanSearch:" + key, JSON.stringify(value));
        } catch (e) {}
    }

    // raw.githubusercontent.com allows cross-site requests, so plain fetch
    // works when the manager has no request function.
    function download(url) {
        const xhr = gm.xmlHttpRequest || (typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : null);
        if (!xhr) return fetch(url).then(r => r.ok ? r.text() : Promise.reject(r.status));
        return new Promise((resolve, reject) => xhr({
            method: "GET",
            url,
            onload: res => res.status === 200 ? resolve(res.responseText) : reject(res.status),
            onerror: reject,
        }));
    }

    (async () => {
        blockedSites = await load("blockedSites", []);
        schedule();
        if (Date.now() - await load("blockedSitesFetched", 0) <= SITES_MAX_AGE && blockedSites.length) return;
        try {
            blockedSites = parseSites(await download(SITES_URL + "?t=" + Date.now()));   // skip GitHub's 5-minute cache
            schedule();
            await save("blockedSites", blockedSites);
            await save("blockedSitesFetched", Date.now());
        } catch (e) {}
    })();

    // "3 hours ago", "2 days ago" etc. in a result means it is fresh, i.e. news.
    const FRESH = /\b\d+\s+(?:minutes?|mins?|hours?|hrs?|days?|weeks?)\s+ago\b/i;
    // After about a week Google shows a calendar date instead ("Oct 8, 2026" or
    // "8 Oct 2026"). Treat anything dated within RECENT_DAYS as news too.
    // Longer windows start catching review/how-to pages that re-date themselves.
    const RECENT_DAYS = 30;
    const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
    const DATE = new RegExp(`\\b(?:${MON}\\s+(\\d{1,2}),?\\s+(\\d{4})|(\\d{1,2})\\s+${MON},?\\s+(\\d{4}))\\b`, "gi");

    function isRecent(text) {
        if (FRESH.test(text)) return true;
        for (const m of text.matchAll(DATE)) {
            const month = MONTHS.indexOf((m[1] || m[5]).toLowerCase());
            const date = new Date(Number(m[3] || m[6]), month, Number(m[2] || m[4]));
            const ageDays = (Date.now() - date) / 864e5;
            if (ageDays > -2 && ageDays < RECENT_DAYS) return true;   // ignore future dates
        }
        return false;
    }

    // Where the result really goes. On phones Google links through /goto with
    // an opaque token, so fall back to the address printed under the site name.
    function destination(link, label) {
        try {
            let u = new URL(link.href);
            if (u.pathname === "/url") u = new URL(u.searchParams.get("q") || u.searchParams.get("url"));
            if (!/(^|\.)google\.[a-z.]+$/.test(u.hostname)) return u;
        } catch (e) {}
        const shown = label.match(/https?:\/\/[^\s›]+/);
        try { return shown ? new URL(shown[0]) : null; } catch (e) { return null; }
    }

    const squash = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");

    function isNews(el, link) {
        // Site name and breadcrumb shown with the title, e.g. "YouTube · BBC News"
        const title = link.querySelector('h3, [role="heading"]');
        const label = link.innerText.replace(title ? title.innerText : "", "");
        const u = destination(link, label);
        if (u) {
            const host = u.hostname.replace(/^www\./, "");
            if (blockedSites.some(d => host === d || host.endsWith("." + d))) return true;
            if (/\/news(\/|$)/i.test(u.pathname)) return true;
        } else {
            // No address at all (phone layout for social media posts): compare
            // the site name, e.g. "Facebook" or "Al Jazeera", with the block list.
            const site = squash(label.trim().split(/\s*[·\n]\s*/)[0] || "");
            if (site && blockedSites.some(d => squash(d.split(".")[0]) === site)) return true;
        }
        if (/\bnews/i.test(label)) return true;
        return isRecent(el.innerText);
    }

    // ---- 5. Structural pass over the results list -----------------------
    const TITLE = 'a h3, a [role="heading"], a[role="heading"]';
    const HEADING = 'h2, h3, [role="heading"]';
    const JUNK = "g-scrolling-carousel, video-voyager, g-section-with-header, g-map, " +
                 "[data-news-cluster-id], [data-local-attribute]";

    const hide = el => { el.style.display = "none"; };

    // A "module" (Videos, Top stories, People also ask...) carries a section
    // heading of its own that is not part of any individual result inside it.
    function isModule(el) {
        // Real results always carry a URL breadcrumb (<cite>); modules don't.
        if (!el.querySelector("cite")) return true;
        for (const h of el.querySelectorAll(HEADING)) {
            if (h.closest("a")) continue;                  // a result title
            if (h.tagName === "H2" || h.getAttribute("aria-level") === "2") return true; // section header
            let p = h.parentElement, owned = false;
            while (p && p !== el) {
                if (p.querySelector(TITLE)) { owned = true; break; }
                p = p.parentElement;
            }
            if (!owned) return true;                       // heading belongs to el itself
        }
        return false;
    }

    // A single result (possibly with sitelinks): keep it unless it is news.
    function judgeResult(el) {
        const link = el.querySelector(TITLE).closest("a");
        if (isNews(el, link)) hide(el);
    }

    function prune(el) {
        if (el.matches(JUNK)) return hide(el);
        const titles = el.querySelectorAll(TITLE).length;
        if (titles === 0) return hide(el);                 // AI overview, PAA, etc.
        if (el.querySelector(JUNK)) return [...el.children].forEach(prune);
        if (titles === 1) return judgeResult(el);
        if (isModule(el)) return hide(el);                 // e.g. a "Videos" block
        const rpos = el.querySelectorAll("[data-rpos]").length + (el.matches("[data-rpos]") ? 1 : 0);
        if (rpos === 1) return judgeResult(el);            // one result with sitelinks
        [...el.children].forEach(prune);                   // plain wrapper: judge each child
    }

    // Each step is guarded so a layout Google changed (or a phone layout we
    // haven't seen) can't stop the results from being filtered.
    const attempt = fn => { try { fn(); } catch (e) { console.warn("Clean search:", e); } };

    function clean() {
        attempt(hideSuggestPanel);
        attempt(addTabs);
        attempt(alignTabs);
        if (!pruneResults) return;
        const root = document.getElementById("rso");
        if (root) [...root.children].forEach(el => attempt(() => prune(el)));
    }

    let queued = false;
    function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; clean(); });
    }

    new MutationObserver(schedule).observe(document.documentElement, {
        childList: true,
        subtree: true,
    });
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", clean);
    } else {
        clean();
    }
})();
