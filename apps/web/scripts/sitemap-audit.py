#!/usr/bin/env python3
"""Audit the sitemap against the protocol and the rules Search Console enforces.

    python3 scripts/sitemap-audit.py
    SITEMAP_SITE=https://staging.tilawah.cc python3 scripts/sitemap-audit.py

Why this exists next to `npm run check`: that one proves the sitemap is well formed
and that its sample answers 200. This one proves the things Search Console rejects
days later — noindex pages listed, a canonical pointing away, an alternate group
that is not reciprocal — and which are invisible until the crawl comes back red.

No dependencies on purpose: it is a release tool, and it must run on a machine that
has nothing installed but Python.
"""
import os
import re
import sys
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime

SITE = os.environ.get("SITEMAP_SITE", "https://tilawah.cc").rstrip("/")
URL = f"{SITE}/sitemap.xml"
NS = {
    "sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
    "xhtml": "http://www.w3.org/1999/xhtml",
}
UA = {"User-Agent": "tilawah-sitemap-audit/1.0"}

problems = []
notes = []


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.headers, r.read()


def check(label, ok, detail=""):
    print(f"  {'ok  ' if ok else 'FAIL'}  {label}" + (f" — {detail}" if detail else ""))
    if not ok:
        problems.append(label + (f": {detail}" if detail else ""))


def main():
    status, headers, body = get(URL)
    print(f"sitemap: {URL}")
    check("HTTP 200", status == 200, str(status))
    ctype = headers.get("content-type", "")
    check("served as XML", "xml" in ctype.lower(), ctype)
    check("not gzipped without a name saying so", not headers.get("content-encoding"), headers.get("content-encoding"))
    check("under 50 MB", len(body) < 50 * 1024 * 1024, f"{len(body)/1024:.1f} KB")

    try:
        root = ET.fromstring(body)
    except ET.ParseError as exc:
        check("well-formed XML", False, str(exc))
        return

    check("root is <urlset>", root.tag == f"{{{NS['sm']}}}urlset", root.tag)
    check("sitemaps.org namespace declared", root.tag.startswith(f"{{{NS['sm']}}}"))
    check("xhtml namespace declared", "xhtml" in body.decode("utf-8", "replace"))

    urls = root.findall("sm:url", NS)
    check("under 50,000 URLs", len(urls) <= 50000, str(len(urls)))
    print(f"  URLs: {len(urls)}")

    locs = []
    groups = {}
    for entry in urls:
        loc_el = entry.find("sm:loc", NS)
        if loc_el is None or not (loc_el.text or "").strip():
            check("<url> has a <loc>", False)
            continue
        loc = loc_el.text.strip()
        locs.append(loc)

        lastmod = entry.find("sm:lastmod", NS)
        if lastmod is not None:
            raw = (lastmod.text or "").strip()
            ok = False
            for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ"):
                try:
                    datetime.strptime(raw, fmt)
                    ok = True
                    break
                except ValueError:
                    pass
            if not ok:
                check(f"lastmod is a W3C datetime ({loc})", False, raw)

        alts = {}
        for link in entry.findall("xhtml:link", NS):
            if link.get("rel") != "alternate":
                check(f"alternate has rel=alternate ({loc})", False, str(link.attrib))
            lang = link.get("hreflang")
            href = link.get("href")
            if not lang or not href:
                check(f"alternate has hreflang and href ({loc})", False)
                continue
            if not re.fullmatch(r"[a-z]{2,3}(-[A-Za-z]{2,4})?|x-default", lang):
                check(f"hreflang is a language code ({loc})", False, lang)
            alts[lang] = href
        groups[loc] = alts

    check("no duplicate <loc>", len(locs) == len(set(locs)), f"{len(locs) - len(set(locs))} duplicate(s)")
    check("every <loc> is absolute https on this host", all(l.startswith(SITE + "/") or l == SITE + "/" for l in locs))
    check("every URL lists itself as an alternate", all(groups[l].get("ar") == l or groups[l].get("en") == l for l in locs))

    # Reciprocal: the group each URL belongs to must be identical from every member.
    bad_reciprocal = []
    for loc, alts in groups.items():
        for lang, href in alts.items():
            if href not in groups:
                bad_reciprocal.append(f"{loc} → {href} (not in sitemap)")
            elif groups[href] != alts:
                bad_reciprocal.append(f"{loc} and {href} disagree")
    check("alternates are reciprocal and complete", not bad_reciprocal, "; ".join(bad_reciprocal[:3]))

    # What Google flags once it fetches: noindex, blocked, canonical, wrong status.
    noindex, blocked, wrong_canonical, bad_status, missing_alternate = [], [], [], [], []
    for loc in locs:
        try:
            status, headers, body = get(loc)
        except urllib.error.HTTPError as exc:
            bad_status.append(f"{loc} {exc.code}")
            continue
        html = body.decode("utf-8", "replace")
        if status != 200:
            bad_status.append(f"{loc} {status}")
        if "noindex" in (headers.get("x-robots-tag") or "").lower():
            noindex.append(f"{loc} (header)")
        meta = re.search(r'<meta[^>]+name="robots"[^>]+content="([^"]+)"', html)
        if meta and "noindex" in meta.group(1).lower():
            noindex.append(f"{loc} (meta)")
        if not meta:
            notes.append(f"{loc} has no robots meta")
        canon = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        if not canon:
            wrong_canonical.append(f"{loc} (no canonical)")
        elif canon.group(1) != loc:
            wrong_canonical.append(f"{loc} → {canon.group(1)}")
        page_alts = set(re.findall(r'<link rel="alternate" hreflang="([^"]+)"', html))
        if page_alts and page_alts != set(groups[loc]):
            missing_alternate.append(f"{loc}: {sorted(page_alts)} vs {sorted(groups[loc])}")

    check("every URL answers 200", not bad_status, "; ".join(bad_status[:3]))
    check("no URL is noindex", not noindex, "; ".join(noindex[:3]))
    check("every canonical points at itself", not wrong_canonical, "; ".join(wrong_canonical[:3]))
    check("page hreflang matches the sitemap", not missing_alternate, "; ".join(missing_alternate[:3]))

    # robots.txt must not block the sitemap or the pages it lists.
    _, _, robots = get(f"{SITE}/robots.txt")
    text = robots.decode("utf-8", "replace")
    check("robots.txt names this sitemap", URL in text)
    check("robots.txt has no blanket Disallow: /", not re.search(r"(?m)^\s*Disallow:\s*/\s*$", text))


main()
print()
if problems:
    print(f"{len(problems)} problem(s):")
    for p in problems:
        print(f"  - {p}")
    sys.exit(1)
print("sitemap: COMPATIBLE with the protocol and with Search Console's checks")
if notes:
    print(f"({len(notes)} note(s), not errors)")
