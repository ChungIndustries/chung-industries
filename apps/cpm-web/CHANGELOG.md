## 0.0.3 (2026-09-01)

### 🚀 Features

- Sign in with GitHub from the website: the new account page shows the packages you maintain and lets you mint, copy once, and revoke the publish tokens your machines and CI authenticate with. ([a4f4357](https://github.com/ChungIndustries/chung-industries/commit/a4f4357))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5

## 0.0.2 (2026-08-31)

### 🚀 Features

- Package responses now expose publish timestamps: `createdAt` on each version and on the package itself (first publish). The website renders them as a relative "published X ago" in the package index rows and in each package's versions list. ([#123](https://github.com/ChungIndustries/chung-industries/issues/123), [#122](https://github.com/ChungIndustries/chung-industries/issues/122))
- Packages can now declare an optional `description` in their `cpm.json` manifest, stating what the package does. The registry validates and stores it at publish and returns it in package responses, and the website shows it under the package name in search results and on package pages, with search matching against it. ([#123](https://github.com/ChungIndustries/chung-industries/issues/123), [#122](https://github.com/ChungIndustries/chung-industries/issues/122))

### 🩹 Fixes

- Give link previews a proper card: a 1200x630 og-image rendering the hero in the site's own theme (brand tile, headline, search bar, and the CraftOS terminal running the bootstrap-and-install script), wired up through og:image and twitter:card summary_large_image meta tags. ([04489da](https://github.com/ChungIndustries/chung-industries/commit/04489da))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5

## 0.0.1 (2026-08-31)

### 🚀 Features

- Initial release of the cpm website at cpm.chungindustries.com: search the registry's packages, browse each package's versions, dependencies, install command, and README, and get started with cpm in one in-game command. ([#106](https://github.com/ChungIndustries/chung-industries/issues/106), [#85](https://github.com/ChungIndustries/chung-industries/issues/85))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5