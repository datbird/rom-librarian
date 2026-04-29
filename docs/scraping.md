# Scraping And Metadata

Scraping support is normalized into three separate concepts.

## Scraper Sources

Scraper sources are where metadata and media come from.

Seed records:

- `screenscraper`
- `launchbox`
- `thegamesdb`
- `mobygames`
- `igdb`
- `openvgdb`

Source records describe:

- access model, such as public web, API key, OAuth, account, or offline database
- metadata fields provided
- media types provided
- ID/hash behavior
- coverage strengths and weak spots
- rate-limit and legal notes

## Scraper Tools

Scraper tools fetch data from sources and write it into frontend-specific stores.

Seed records:

- `skraper`
- `arrm`
- `skyscraper`
- `sselph-scraper`
- `launchbox-scraper`

Tool records describe:

- compatible frontends
- supported sources
- input assumptions
- output metadata stores
- safe AI operations
- risky AI operations

## Metadata Stores

Metadata stores are where frontends persist scraped data.

Seed records:

- `emulationstation-gamelist`
- `launchbox-data-xml`
- `pegasus-metadata`

Store records describe:

- file paths
- format type
- metadata fields
- media folder conventions
- write-safety rules
- useful AI operations

## Example AI Tasks

For a request like "be sure all the 3DO games have screenshots and descriptions":

- identify the frontend and metadata store
- inspect the 3DO platform metadata entries
- check each game for description and screenshot/image fields
- verify referenced image files exist
- produce a missing-data report
- recommend an appropriate scraper source/tool
- only write metadata after backing up the store and receiving approval

For a request like "for all Japanese-developed games ensure they all have English manuals":

- use developer/publisher metadata as a candidate filter, not absolute truth
- identify games with Japanese developers or publishers
- check existing manual fields and media folders
- distinguish English manuals from manuals in other languages when filenames or metadata allow it
- produce a review list before downloading, copying, or editing metadata

## Safety Rules

- Do not store API keys or OAuth secrets in rom-librarian configs.
- Do not overwrite frontend metadata stores without a backup.
- Do not edit LaunchBox XML while LaunchBox is open.
- Preserve unknown XML nodes/fields.
- Treat scraper results as suggestions when matching is fuzzy.
- Prefer audit reports before media downloads or bulk rewrites.


## Expanded Providers

The static scraper/tool layer now includes built-in ES-DE/Batocera/RetroBat scrapers, RomM metadata providers, Playnite plugins, Steam ROM Manager artwork providers, Igir, EmuMovies, RetroAchievements, Redump, No-Intro/DAT-o-MATIC, Arcade Database, MAME software lists, RAWG, and GiantBomb. The normalized provider layer remains intentionally smaller and source-backed.
