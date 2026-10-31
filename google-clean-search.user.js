// ==UserScript==
// @name         Google: Clean Web Results
// @namespace    https://github.com/drochf/search-filter
// @version      2.1
// @description  Forces Google into "Web" mode (udm=14) and hides everything that is not an ordinary result: AI overviews, ads, images, videos, maps, news, "People also ask", related searches. Also hides results from news websites, and replaces Google's tab bar with All / Web / Images / Maps.
// @match        https://www.google.com/search*
// @match        https://google.com/search*
// @match        https://www.google.ca/search*
// @match        https://google.ca/search*
// @downloadURL  https://raw.githubusercontent.com/drochf/search-filter/main/google-clean-search.user.js
// @updateURL    https://raw.githubusercontent.com/drochf/search-filter/main/google-clean-search.user.js
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
    "use strict";

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
        #rso img                            /* all thumbnails and favicons */
        { display: none !important; }
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
    const NEWS_DOMAINS = [
        // International / wire
        "reuters.com", "apnews.com", "aljazeera.com", "aljazeera.net", "bbc.com", "bbc.co.uk",
        "dw.com", "france24.com", "euronews.com", "rt.com", "tass.com", "afp.com",
        "news.google.com", "news.yahoo.com", "msn.com", "newsnow.co.uk", "newsnow.com",
        "wikinews.org", "semafor.com", "axios.com",
        // US
        "cnn.com", "nytimes.com", "washingtonpost.com", "wsj.com", "foxnews.com", "foxbusiness.com",
        "nbcnews.com", "cbsnews.com", "abcnews.go.com", "abcnews.com", "npr.org", "pbs.org",
        "msnbc.com", "cnbc.com", "bloomberg.com", "politico.com", "thehill.com", "usatoday.com",
        "latimes.com", "nypost.com", "time.com", "newsweek.com", "theatlantic.com", "newyorker.com",
        "vox.com", "huffpost.com", "businessinsider.com", "insider.com", "thedailybeast.com",
        "slate.com", "salon.com", "motherjones.com", "theintercept.com", "propublica.org",
        "breitbart.com", "dailywire.com", "theblaze.com", "newsmax.com", "oann.com",
        "washingtonexaminer.com", "washingtontimes.com", "nationalreview.com", "newrepublic.com",
        "thenation.com", "realclearpolitics.com", "realclearworld.com", "rollingstone.com",
        "chicagotribune.com", "bostonglobe.com", "sfchronicle.com", "nbcnews.com", "upi.com",
        // UK / Ireland
        "theguardian.com", "independent.co.uk", "telegraph.co.uk", "dailymail.co.uk", "thesun.co.uk",
        "mirror.co.uk", "express.co.uk", "thetimes.co.uk", "thetimes.com", "news.sky.com", "ft.com",
        "economist.com", "standard.co.uk", "metro.co.uk", "inews.co.uk", "huffingtonpost.co.uk",
        "politico.eu", "gbnews.com", "lbc.co.uk", "irishtimes.com", "rte.ie", "independent.ie",
        // Canada
        "cbc.ca", "ctvnews.ca", "globalnews.ca", "theglobeandmail.com", "nationalpost.com",
        "thestar.com", "torontosun.com", "cp24.com", "citynews.ca", "macleans.ca",
        "ottawacitizen.com", "montrealgazette.com", "vancouversun.com", "thecanadianpress.com",
        "lapresse.ca", "ledevoir.com", "radio-canada.ca", "thetyee.ca", "canadaland.com",
        // Australia / Asia / Middle East
        "abc.net.au", "smh.com.au", "theage.com.au", "news.com.au", "scmp.com", "indiatimes.com",
        "hindustantimes.com", "ndtv.com", "thehindu.com", "haaretz.com", "timesofisrael.com",
        "jpost.com", "straitstimes.com", "japantimes.co.jp",
        // Ukraine / Russia war coverage
        "kyivindependent.com", "kyivpost.com", "pravda.com.ua", "ukrinform.net", "meduza.io",
        "themoscowtimes.com", "understandingwar.org", "liveuamap.com",
    ];
    // "3 hours ago", "2 days ago" etc. in a result means it is fresh, i.e. news.
    const FRESH = /\b\d+\s+(?:minutes?|mins?|hours?|hrs?|days?|weeks?)\s+ago\b/i;

    function isNews(el, link) {
        let u;
        try { u = new URL(link.href); } catch (e) { return false; }
        if (u.pathname === "/url") {
            try { u = new URL(u.searchParams.get("q") || u.searchParams.get("url")); } catch (e) { return false; }
        }
        const host = u.hostname.replace(/^www\./, "");
        if (NEWS_DOMAINS.some(d => host === d || host.endsWith("." + d))) return true;
        if (/\/news(\/|$)/i.test(u.pathname)) return true;
        // Site name and breadcrumb shown with the title, e.g. "YouTube · BBC News"
        const title = link.querySelector('h3, [role="heading"]');
        const label = link.innerText.replace(title ? title.innerText : "", "");
        if (/\bnews/i.test(label)) return true;
        return FRESH.test(el.innerText);
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

    function clean() {
        addTabs();
        alignTabs();
        if (!pruneResults) return;
        const root = document.getElementById("rso");
        if (root) [...root.children].forEach(prune);
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
