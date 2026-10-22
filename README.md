![Roselle](icon.png)

# Roselle

![Flarum](https://img.shields.io/badge/flarum-2.x-e7672e?style=flat-square) [![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[English](README.md) · [简体中文](README.zh-Hans.md)

A Flarum 2 theme forked from [Canela](https://github.com/ram0ng1/canela), inspired by Discourse's Horizon theme and laid out after meta.discourse.org.

Roselle keeps the Discourse structure — a sidebar with sections, a discussion list in columns, a topic map and timeline, profiles with a cover — and adds this forum's own customizations. Every feature can be switched on or off from the admin panel, and the whole palette derives from Flarum's primary colour in both light and dark mode.

## Requirements

- Flarum 2.x
- PHP 8.2+

Optional extensions are detected at runtime; without them the related cards are locked, and nothing breaks. When an installed extension already provides a feature, the theme delegates to it and only adapts the presentation — see [Integrations](#integrations).

## Installation

```sh
composer require lcoy/roselle
php flarum migrate
php flarum assets:publish
```

Then enable **Roselle** on the Extensions page. Settings live under the theme's own admin panel, grouped into Appearance, Header and sidebar, Discussion list, Topic, Composer and search, Profile and users, Community, Moderation and Integrations.

If the forum uses bookmark reminders, keep `php flarum schedule:run` in cron.

## Features

**Structure**

- Sidebar with collapsible sections, tags with unread dots, custom links and a footer
- Header search pill, user menu with notification panels, login and sign-up pages
- Discussion list in columns (posters, replies, views, activity), New / Unread / Top tabs, tag filters, infinite scroll
- Topic page with discussion map, timeline, suggested discussions, share modal, inline title editing and edit history

**Reading and writing**

- Discourse-style composer: toolbar layout, side-by-side preview, similar discussions, linked topic, drafts (fof/drafts), hashtags and the Flamoji emoji picker
- Image zoom (fof/photoswipe), code block buttons, heading anchors, table expansion, blurred spoilers, local dates
- Bookmark reminders, mention cards, print view, copy-link feedback and keyboard shortcuts

**Profiles and community**

- Profile with title, status and birthday from the theme, bio from fof/user-bio, social links from fof/socialprofile and a cover from forumaker/profile-cover
- Summary and activity tabs (read, reactions, votes, solved), user directory (fof/user-directory), group pages, About page with extra tabs, guidelines and legal redirects
- Invite links and the user card popover

## Integrations

The theme never reimplements what an installed extension already does: it styles the extension's output or reads its data. Adaptation code lives in `js/src/forum/thirdparty/` and the per-feature modules; "delegated" means the extension owns the feature and the theme only presents it.

### Adapted extensions

| Extension | What the theme does |
|---|---|
| `flarum/tags` | Tag and category pages, sidebar tag tree, `#tag` composer, tag filters and colored accents |
| `flarum/mentions` | Quote headers, hashtag pills, embedded replies and the reply-to line |
| `flarum/likes` | Like button and summary in the post bar; topic-level "liked by me" filter and likes sort |
| `flarum/subscriptions` | Discourse-style notification dropdown in the topic footer |
| `flarum/messages` | Message button on the profile card and the messages panel |
| `flarum/flags` | Flag button in the topic footer and the flags review queue |
| `flarum/approval` | Review queue and the "queued" filter |
| `flarum/lock`, `flarum/sticky` | Search filters, plus sticky ordering above explicit sorts |
| `flarum/nicknames` | Display name above the username on posts, cards and profiles |
| `flarum/suspend` | Suspended members cannot edit the extended profile (policy) |
| `flarum/markdown`, `flarum/bbcode` | Format selector and toolbar in the composer |
| `flarum/emoji` | Emoji rendering in posts and the composer preview |
| `flarum/pusher` | "There are N new replies" bar while reading a topic |
| `fof/discussion-views` | Delegated: counts and exposes views. The theme keeps its Views column and "Most viewed" sort, reading `views` / `view_count` |
| `pianotell/flarum-ext-flamoji` | Delegated: owns the composer emoji picker; the theme lays out the toolbar around it |
| `fof/photoswipe` | Delegated: image zoom in posts |
| `fof/user-directory` | Delegated: the `/users` directory page |
| `fof/user-bio` | Delegated: profile bio; the theme places it in the profile bands and reads `bioHtml` in the user card popover |
| `fof/socialprofile` | Delegated: website and social links on the profile |
| `forumaker/profile-cover` | Delegated: cover and card background, including its editor |
| `fof/best-answer` | Solution bar and the accepted-answer accordion |
| `fof/reactions` | Combined like/reaction button and reaction summary |
| `fof/polls` | Discourse-style poll grid and vote count |
| `fof/upload` | Upload progress in the composer |
| `fof/drafts` | Discourse-style drafts: autosave, resume, close prompt and drafts list |
| `fof/links` | Links moved into the sidebar |
| `fof/follow-tags` | Tag notification bell in the category header; the extension's duplicate follow button is removed |
| `fof/forum-widgets-core` | News, stats, online users and top posters widgets rendered as sidebar sections |
| `fof/pages` | Extra tabs in the About area |
| `fof/terms` | Terms and privacy tabs, `/tos` and `/privacy` redirects |
| `fof/formatting` | Formatting buttons and markdown tables in the composer |
| `fof/synopsis` | List excerpts, moved into the theme's row |
| `fof/badges` | Its badge items are laid out with the profile chips and beside the post author |
| `tryhackx/flarum-thumb-sliders` | Disables its own row layout; the slider sits inside the theme row |
| `lcoy/recommendations` | Recommendation tabs as a sidebar section |
| `huseyinfiliz/stickiest` | Sticky-topic ordering; the theme's pinning mutator covers explicit sorts |

### Optional integrations

Built for extensions that this forum does not currently run; they stay dormant and activate if the extension is installed.

| Extension | What the theme does |
|---|---|
| `fof/discussion-thumbnail` | Thumbnails beside the title in the discussion list |
| `flarum/realtime` | Styling for the "user is typing" indicator (Flarum 2 forums use Pusher instead) |

## Development

```sh
cd js
npm ci
npm run build          # webpack -> js/dist/forum.js and js/dist/admin.js
```

After changing PHP, LESS or locale files, rebuild what Flarum caches:

```sh
php flarum assets:publish    # publish js/dist and the extension assets
php flarum cache:clear       # run as the web user (www), never as another user
```

Saving a setting that feeds LESS (font, loading indicator) already marks the
stylesheets for rebuilding on the next request. If the compiled files under
`public/assets` are owned by another user, that rebuild cannot write them —
keep `public/assets` and `storage` owned by the web user.

Static checks:

```sh
composer analyse     # PHPStan
composer test        # PHPUnit
```

Releases are built from tags. Pushing a `vX.Y.Z` tag runs `.github/workflows/release.yml`, which packages the compiled theme with `git archive` (development files excluded by `.gitattributes`), attaches `roselle-X.Y.Z.zip` and creates the GitHub release with generated notes. Tags with a suffix, such as `v1.0.0-rc.1`, become pre-releases.

## Project layout

```
extend.php            base settings, frontend assets, service providers
extend/               one file per feature; only files listed in extend/.enabled load
  .enabled            feature whitelist (one name per line)
src/                  PHP: API resources, formatters, controllers, policies
js/src/forum/         forum app (initializers, features, adaptation layer)
js/src/admin/         admin panel (cards, controls, panel chunk)
less/                 LESS sources, compiled by Flarum
locale/               en.yml, zh-Hans.yml (keys must match)
migrations/           tables for the active features only
views/                error-page overrides
assets/               fonts and locale flags
```

A feature file that fails to load is skipped and logged, so the forum keeps running with the rest. For debugging a single feature without touching the whitelist, send the `X-Canela-Probe: <feature>` header.

## Languages

English and Simplified Chinese ship with the theme. Core and extension strings come from the Flarum language packs.

## Credits

Forked from **Canela** by [Ramon Guilherme](https://ramonguilherme.com.br), itself inspired by Discourse's Horizon theme. Canela is an unofficial project, not affiliated with or endorsed by Discourse. Roselle is maintained by Lcoy.

## License

[MIT](LICENSE).
