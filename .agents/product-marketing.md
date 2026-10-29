# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-10-28
**Status:** auto-drafted from the repo, not yet corrected by the founder. Sections marked ⚠ are inferences that need confirmation.

## Product Overview

**One-liner (Arabic, shipped copy):**
> مشغّل القرآن الكريم مفتوح المصدر: تلاوات كاملة تُبَثّ ندّاً بندّ في المتصفّح، مع بديل من خادمنا عند تعذّر الأقران.

**One-liner (English, draft):**
An open-source Quran player that streams full recitations peer-to-peer in the browser, with the operator's own server as the safety net.

**What it does:**
One screen. Open the site, see the reciter and surah you were last listening to, press play. Audio arrives from WebTorrent peers; if no peer answers within 8 seconds, the operator's own HTTP web seed carries the stream without changing the audio source. No account server, no ads, no listening history on our side.

**Product category (the shelf):** Quran recitation player / listen-to-Quran web app. Searched as: "القرآن الكريم استماع", "سورة الكهف سعد الغامدي", "listen to Quran online", "Quran recitation mp3".

**Product type:** free web app + installable PWA, backed by a self-hostable stack (edge, tracker, seeder, TURN, admin console).

**Business model:** none. MIT-licensed, self-hostable, no ads, no subscription, no paid tier. Privacy is architectural (no server-side account; state lives in the browser and in a user-held keypair), not a policy promise.

## Target Audience

**Primary:** Arabic-speaking Quran listeners, mobile-first, who listen to whole surahs rather than clips — commute, work, household, before sleep, memorisation review.

**Secondary:** Quran-technology builders and operators who might run a seeder or TURN node, or fork the stack. Reached through `community.itqan.dev`.

**Tertiary (stated launch intent):** English-speaking Muslim listeners, reached through Reddit. ⚠ Not yet validated; no English content is indexed today (single URL, `lang="ar"`).

**Decision-makers:** none — the listener decides alone. No procurement, no team.

**Primary use case:** press play on a specific reciter and surah and keep listening without ads, an account, or buffering.

**Jobs to be done:**
- Listen to a full surah uninterrupted, often with the screen off or the tab backgrounded.
- Resume the same recitation later without hunting for where I stopped.
- Re-listen to a passage while reviewing memorisation.

**Use cases:**
- Long session on a phone, weak or shared network → web-seed fallback carries it.
- Reopening the app next day → cold start restores reciter, surah, position, paused (never autoplay).
- Switching riwaya (Hafs / Warsh / Qalon) because that is how the listener recites.

## Personas (audience segments, not B2B roles)

| Segment | Cares about | Challenge | Value we promise |
|---|---|---|---|
| Listener (alpha cohort) | Uninterrupted listening, no ads, Arabic UI, position kept | Existing apps interrupt, monetise, or require an account | Open, press play, continue where you stopped |
| Builder (Itqan forum) | Clean architecture, open source, Quranic data standards | Crowded field of Quran apps with unclear technical claims | A real P2P + fallback reference implementation, readable source |
| Operator (self-hoster) | Bandwidth cost, disk caps, one-command deploy | Serving audio traffic is expensive | `deploy-node.sh`, disk quotas, Watchtower updates |

## Problems & Pain Points

**Core problem:** listening to a full recitation is interrupted by advertising, account walls, or buffering, and finding the same reciter and surah again is several taps.

**Why alternatives fall short:**
- Ad-supported apps interrupt the recitation itself.
- Account-based apps hold the listening history; the listener does not.
- Streaming services compress audio and cannot offer riwaya or full-surah files.
- Direct MP3 links have no resume, no reciter catalogue, no mobile polish.

**What it costs them:** repeated re-navigation, lost position, mobile data spent re-downloading the same surah.

**Emotional tension:** ⚠ distrust of products that monetise religious content, and of apps that collect more than they need. Worth testing in interviews — it is the strongest hypothesis for why someone would switch.

## Competitive Landscape

**Direct:** Quran.com (web + apps) — comprehensive, app-heavy, account-centric. Tarteel — memorisation and AI recitation feedback, account required. Ayat (KSU) — strong reading surface, less listening focus. MP3Quran — deep reciter catalogue, direct files, no resume. QuranicAudio — plain archive of full recitations. Spotify/YouTube playlists — convenient, ads, compression, no riwaya.

**Secondary:** locally stored MP3s; podcast feeds of recitations.

**Indirect:** reading from a mushaf instead — the real default for many listeners.

**How they fall short for us:** none of them treat delivery cost as a design problem, and none make "your listening stays yours" an architectural fact.

## Differentiation

- **P2P with an operator safety net.** Listeners serve each other; the server is a fallback, not a bottleneck. The fallback is added after 8s with zero peers and never replaces the audio source — so a peer handover cannot stall playback.
- **No account server.** State is in the browser plus a user-held keypair; the operator cannot read a listening history because it never receives one.
- **One screen, no navigation model.** Open → press play. No tabs, no queue column, no dashboard.
- **Riwaya is data, never a default.** Hafs, Warsh, Qalon, unknown — shown, not assumed.
- **Open source and self-hostable.** No vendor can shut the catalogue down.
- **Installable PWA** with a service worker that answers range requests, so seeking works while the torrent is far from complete.

## Objections

All rows are hypotheses to validate in Phase 1 interviews — none are quoted from users yet.

| Objection | Response |
|---|---|
| "P2P means torrents — is this piracy?" | Recitations are licensed and sourced through the Itqan CMS; the browser never contacts the source host. The swarm distributes material the operator is entitled to serve. |
| "Will it buffer on a weak connection?" | Peer-first for 8s, then the operator's HTTP seed carries the stream and keeps seeding back to peers. |
| "Why not just use Quran.com?" | If your job is tafsir, translation, or search, use it. This does one thing: play the surah you chose. |
| "Does it work on my iPhone?" | Yes, with a known first-load caveat: iOS Safari needs one prior navigation before the service worker can stream; the first play on a fresh origin may show an error with a retry. |
| "Will this still exist next year?" | ⚠ The weakest claim today — the project sits on a free-tier subdomain. Fixing that is a launch prerequisite, not a marketing line. |

**Anti-persona:** anyone who wants tafsir, translation, word-by-word study, search across the text, or social features. Sending them here wastes their time.

## Switching Dynamics

**Push:** ads mid-recitation, accounts, telemetry unease, buffering, re-navigating to find the same surah.
**Pull:** no ads, no account, Arabic-first, one screen, position remembered, open source.
**Habit:** the Quran app already installed, the bookmark already saved, the MP3 already downloaded.
**Anxiety:** that P2P is somehow improper, that a new project will disappear, that a browser player cannot be as reliable as an installed app.

The habit and the anxiety both beat the pull on their own. The only credible counter is being *demonstrably* smooth for someone already listening daily — proof, not persuasion.

## Customer Language

⚠ **Empty by design.** No listener has been interviewed yet; fabricating quotes here would poison every downstream skill. Phase 1 fills this.

**How they describe the problem:** (to be collected — Itqan forum threads, Reddit mining, 6–10 listener interviews)

**How they describe us:** (to be collected)

**Words to use (from shipped copy):** تلاوات كاملة · ندّاً بندّ · مفتوح المصدر · بديل من خادمنا عند تعذّر الأقران · مشغّل القرآن الكريم

**Words to avoid:** "منصة" / "platform" (implies a business), "streaming service", "AI", "revolutionary", "free forever" (an unkeepable promise), and any claim about number of users before there are any.

**Glossary:**

| Term | Meaning |
|---|---|
| ندّاً بندّ | The Arabic rendering of peer-to-peer used in the shipped description |
| Riwaya / رواية | The recitation transmission (Hafs, Warsh, Qalon) |
| Seed / web seed | The operator's HTTP copy of the audio, used when no peer answers |
| Ring | One SEA keypair shared across a listener's paired devices; syncs favourites and devices, not listening state |

## Brand Voice

Derived from `DESIGN.md` ("quiet desk", closer to a printed mushaf than a streaming app) and the shipped Arabic copy.

| Attribute | Means | Doesn't mean | Example line |
|---|---|---|---|
| Quiet | Restrained, few words, no exclamation marks | Cold or clinical | "page is the player" (spec §1) |
| Precise | Names the mechanism honestly, including limits | Over-explaining in the UI | "بديل من خادمنا عند تعذّر الأقران" |
| Humble | Service to the reader, not the builder | Self-deprecating | "بحمد الله" register used by the surrounding community |
| Arabic-first | Arabic is the original, not a translation | Arabic-only forever | `dir="rtl"`, `lang="ar"` by default |

**Tone by context:**
- Product UI: quiet, verbs, no marketing adjectives.
- Launch post (Itqan): first-person, what it does, what it does not, source link.
- Errors: plain statement of what failed + one retry action.
- Social / Reddit: same voice, no growth-speak, disclose that you built it.
- Press / directory: mechanism first, privacy second, never "fastest".

**Terms we own:** ندّاً بندّ (as a descriptor of delivery) · "the page is the player"
**Never use:** "منصة" for this project, "free forever", superlatives about audio quality.

## Proof Points

**Metrics:** none. No analytics are installed (`apps/web/package.json` has no tracking dependency), so there are no user numbers, no retention, no P2P-vs-fallback ratio.
**Customers:** none yet — alpha has not started.
**Testimonials:** none.
**Value themes to prove:** (1) it plays without interruption, (2) it remembers, (3) nobody is watching.

Do not cite user counts, ratings, or downloads in any copy until Phase 2 instrumentation exists.

## Goals

**Business goal:** ⚠ Non-commercial. The stated goal is adoption and durability, not revenue: enough regular listeners that the project is worth maintaining, and enough operators that no single node is a point of failure.
**Conversion action (alpha):** a completed first listen, then a second session within 7 days.
**Current metrics:** none. See Proof Points.

## Learnings

*Decisions and tested lessons. Newest first. Keep to about 20 active entries.*

| Date | Learning | Evidence | Applies to | Status |
|---|---|---|---|---|
| 2026-10-28 | The alpha cohort reachable today (Itqan forum + WhatsApp) are builders, not listeners; they validate architecture, not retention. | Forum tag counts + thread activity, 2026-10-28 | customer-research, launch | watch |

## Open decisions (founder to confirm)

1. **Primary audience in the doc's own words** — listeners (current draft) or self-host operators? The repo's top-level README reads as infrastructure; `apps/web` reads as a listener product. The two need different copy and different launch channels.
2. **Domain** — `tilawa.quran.us.kg` (free tier) vs a paid domain bought before launch. Gates canonical, OG, sitemap, Umami hostname, and every future link.
3. **English** — separate `/en` entry point, or Arabic-only until Phase 1 says otherwise.
4. **This file in git?** `.agents/` is untracked and not in `.gitignore`.

## Changelog

- v1 (2026-10-28) — Initial context, auto-drafted from README.md, DESIGN.md, apps/web/README.md, the minimal-player spec, index.html, and the Itqan forum's public API. Customer Language and Proof Points deliberately left empty: no interviews, no instrumentation.
