// ==UserScript==
// @name         Google: Clean Web Results
// @description  Forces Google into "Web" mode (udm=14) and hides everything that is not an ordinary result: AI overviews, ads, images, videos, maps, news, "People also ask", related searches.
// @match        https://www.google.com/search*
// @match        https://google.com/search*
// @match        https://www.google.ca/search*
// @match        https://google.ca/search*
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
    "use strict";

    // ---- 1. Redirect into Web mode --------------------------------------
    // Loop guard is time-based: skip only if this exact query was redirected
    // in the last 5 seconds (i.e. Google bounced us back).
    const url = new URL(location.href);
    if (!url.searchParams.has("udm") && !url.searchParams.has("tbm")) {
        const key = "cleanSearch:" + (url.searchParams.get("q") || "");
        let last = 0;
        try { last = Number(sessionStorage.getItem(key)) || 0; } catch (e) {}
        if (Date.now() - last > 5000) {
            try { sessionStorage.setItem(key, String(Date.now())); } catch (e) {}
            url.searchParams.set("udm", "14");
            location.replace(url.toString());
            return;
        }
    }

    // ---- 2. CSS: hide known clutter -------------------------------------
    const style = document.createElement("style");
    style.textContent = `
        #rcnt > :not(#center_col),          /* knowledge panel, image/video header */
        #tads, #tadsb, #bottomads,          /* ads */
        #bres,                              /* related searches */
        g-scrolling-carousel, video-voyager, g-section-with-header, g-map,
        [data-news-cluster-id], [data-local-attribute],
        #rso img                            /* all thumbnails and favicons */
        { display: none !important; }
    `;
    document.documentElement.appendChild(style);

    // ---- 3. Structural pass over the results list -----------------------
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

    function prune(el) {
        if (el.matches(JUNK)) return hide(el);
        const titles = el.querySelectorAll(TITLE).length;
        if (titles === 0) return hide(el);                 // AI overview, PAA, etc.
        if (el.querySelector(JUNK)) return [...el.children].forEach(prune);
        if (titles === 1) return;                          // a single result: keep whole
        if (isModule(el)) return hide(el);                 // e.g. a "Videos" block
        const rpos = el.querySelectorAll("[data-rpos]").length + (el.matches("[data-rpos]") ? 1 : 0);
        if (rpos === 1) return;                            // one result with sitelinks
        [...el.children].forEach(prune);                   // plain wrapper: judge each child
    }

    function clean() {
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
