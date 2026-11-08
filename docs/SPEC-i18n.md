# Spec: `i18n`

**Ported from obzorarr,** the reference app for `i18n`
([Shared groundwork](../AGENTS.md#shared-groundwork)): its full spec (`f41c712:docs/SPEC-i18n.md`
in obzorarr), the message rules its #301 added, and its code and tests at `7368cff`. Everything is
the same except:
- **Decision numbers:** D28 and D29 hold the decisions (obzorarr's D21 and D22), D16 the runtime
  validation gaps, D32 the dependencies. obzorarr's instance zone (its D24) has no counterpart.
- **Time zones:** callers pass `formatDateTime` the zone their module's spec names, such as the
  viewer's ([Formatting](#formatting)), not an instance zone.
- **What isn't translated** and how English is spelled: the name otpravkarr, always lowercase;
  text the owner writes, such as lineup names; British spelling (D28).
- **The placeholder's text** ([Messages](#messages)), where the switcher goes on the landing brief,
  and where the shells place it ([The language switcher](#the-language-switcher)).
- **Keyboard focus:** the switcher is otpravkarr's first focusable control, so its build adds the
  app's one global `:focus-visible` rule ([Focus](#focus)).
- **Examples** use otpravkarr's wording; the rules, and the message check's cases and the problems
  each reports, are #301's.
- **Evidence:** the Weblate round trip and the concurrency check may cite obzorarr's #297 and #298
  only when every version and file listed under [Validation](#validation) matches obzorarr's
  `7368cff`.

**Status:** proposed for the owner's approval. Module 2 of the capability map
([docs/SPEC.md](SPEC.md)).

## Objective

Every later module writes its user-facing text as messages in English and Danish, and shows numbers
and dates formatted for the viewer's language (D28). `i18n` builds that groundwork, and no product
text beyond the placeholder page:
1. **Messages** in `messages/en.json` and `messages/da.json`, which Paraglide JS compiles into typed
   message functions (D29).
2. **Choosing the language:** each request uses the viewer's choice, then the browser's preferred
   languages, then English. The browser keeps the language the server chose for the page.
3. **The language switcher.**
4. **Formatting** numbers, dates and times for the viewer's language.
5. **The message check:** every message exists in both languages, with the same placeholders and
   the plural forms each language needs.

It also runs the validations D29 lists.

## Versions

`@inlang/paraglide-js` and `@inlang/plugin-i18next`, the two packages D29 names, as exact-pinned dev
dependencies at their newest stable release when they join (D32): today 3.2.1 and 6.5.3, the
versions obzorarr validated. Paraglide JS 3's breaking changes touch nothing here: the
`additionalFiles` option and the middleware's locale splitting are gone, and Vite builds default to
a new output layout, which the config below sets explicitly. TypeScript stays on 6.x (D2):
Paraglide 3 writes its declarations itself and needs no TypeScript.

## Messages

**The files** are i18next JSON v4 (D29): one flat object per language, formatted by Biome like the
rest of the repo.

**Message names** match `^[a-z][a-z0-9]*(_[a-z0-9]+)+$`: snake_case, starting with the module or
surface that owns them (`landing_title`, `error_not_found_title`). So each is a JavaScript name,
`m.landing_title()`, and Paraglide's escaped names and the `m["a.b"]()` form of nested keys never
appear.
- **Plural forms:** a key that ends in a CLDR plural category (`_zero`, `_one`, `_two`, `_few`,
  `_many`, `_other`) is a plural form of the message named by the rest of the key
  (`lineup_channels_one` belongs to `lineup_channels`), and no other key ends in one: such a key is
  a plural form by definition, so the plural rules below catch it (`setup_step_one` alone is a
  plural with one form and no `{{count, number}}`). A message is either one key or plural forms,
  never both.
- **`_ordinal`:** no key contains `_ordinal_`, which the plugin reads as an ordinal plural.
- **Renaming:** once Weblate is connected, keys aren't renamed, because translations are tied to
  them.

**Placeholders** are `{{name}}`.
- A count or quantity is written `{{name, number}}`, which Paraglide formats with
  `Intl.NumberFormat` in the message's language ("1,234 channels", "1.234 kanaler"). A bare
  `{{count}}` would print "1234".
- A number that is a name rather than a quantity, such as a year, is a bare `{{year}}`: the
  `number` format would print "2,025".
- No format other than `number` is allowed. In particular, Paraglide compiles
  `{{name, datetime}}` to `Intl.DateTimeFormat` with no time zone, which formats in the zone of
  whatever machine runs it. Dates are formatted with `formatDateTime` (below) and passed in as text.
- A number in a message that states how the app behaves (a limit, a duration, a count) is passed in
  from the constant the logic uses, never written into the text, so the copy can't drift from the
  behaviour.

**Plurals** are `<name>_one` and `<name>_other`, chosen by `count`. English and Danish both have
exactly these two categories (`Intl.PluralRules`). Danish uses `one` for every number below 2 except
0 (0.5 and 1.5 included), so every plural form keeps `{{count, number}}` rather than writing the
number out ("1 time" would misstate 1.5 hours).

**Messages are plain text.** They are rendered as text, never with `{@html}`, so a placeholder
filled with a name can't inject markup.
- **No tags:** the plugin reads anything shaped like a tag (`<address>`, `<br/>`, `</b>`) as markup,
  and Paraglide drops it from the text without a warning: `ORIGIN=<address>` renders as `ORIGIN=`. A
  value to fill in is a placeholder (`ORIGIN={{address}}`).
- **Markup inside a message,** such as a link in a sentence, is left to the first module that needs
  it.

**English** uses British spelling (D28), as the legacy app did.

**Not translated through the messages:**
- the name otpravkarr, always lowercase (PRODUCT.md);
- text the owner writes, such as lineup names, which come from the owner's configuration (D28);
- log entries and console output, which are for operators and stay in English;
- the switcher's language names (below).

**Who writes them:** agents write the English and the Danish. The owner may spot-check the Danish
but doesn't approve it, and Weblate corrects it later.

**The inlang project** is `project.inlang/settings.json`:

```json
{
	"$schema": "https://inlang.com/schema/project-settings",
	"baseLocale": "en",
	"locales": ["en", "da"],
	"modules": ["./node_modules/@inlang/plugin-i18next/dist/index.js"],
	"plugin.inlang.i18next": { "pathPattern": "./messages/{locale}.json", "contextValues": [] }
}
```

- **The plugin loads from disk,** so nothing is fetched at build time or in CI.
- `"contextValues": []` turns off the plugin's guess at i18next contexts, which would read a key
  such as `title_short` next to `title` as a variant of `title`.

**Paraglide's options** are in `project.inlang/paraglide.config.ts`, which both the CLI and the Vite
plugin read, so they are kept in one place:

```ts
import { defineConfig } from "@inlang/paraglide-js";

export default defineConfig({
	outdir: "./src/lib/paraglide",
	strategy: ["cookie", "preferredLanguage", "baseLocale"],
	cookieSameSite: "lax",
	cookieSecure: "auto",
	emitTsDeclarations: true,
	outputStructure: "message-modules",
});
```

- `outputStructure` is set because the CLI and the Vite plugin would otherwise write different
  layouts into the same folder: the Vite plugin's default (`virtual-modules`) is one the CLI can't
  write. Running `check` beside `dev` would then rewrite the folder under the dev server.
- The plugin is added to `vite.config.ts` as `paraglideVitePlugin({ project: "./project.inlang" })`,
  with nothing else.
- `tsconfig.json` includes `project.inlang/*.ts`, so `check` type-checks the config.

**Generated files** are gitignored by two root `.gitignore` lines, which Biome also honours:
- `src/lib/paraglide/`, the compiled output;
- `project.inlang/cache/`, where Paraglide 3 keeps its compile cache. It writes no `.gitignore` of
  its own there, and without the line `lint` fails on the cache files.

**The compiled output** compiles in `prepare` and in `check` (the CLI, before `svelte-check`), and
through the Vite plugin in dev, build and Vitest. Panda's `exclude` skips it.
- **`#lib/paraglide/messages.js` and `#lib/paraglide/runtime.js`** are browser-safe.
- **`#lib/paraglide/server.js`,** the middleware, loads `async_hooks` for AsyncLocalStorage. In app
  code only `src/hooks.server.ts` imports it; `format.test.ts` uses it to set each request's
  language.
- **The import rules:** the output is generated code that imports nothing from the app. It isn't one
  of the app's layers, so `lib/shared/`, components, services and routes import it as they import
  `#styled-system`.
- **A message that doesn't exist** is a type error that `check` reports.

**The placeholder `/`** renders its heading ("Stream access.") and its sentence ("Sign-in with Plex
is being rebuilt. Access is available to accepted friends of the server owner.") as the messages
`landing_title` and `landing_sign_in_status`. Its wordmark and `<title>` stay the name otpravkarr.

## Choosing the language

**On the server,** `handle` in `src/hooks.server.ts` runs every request through
`paraglideMiddleware`:
- **The order:** the `PARAGLIDE_LOCALE` cookie when it holds `en` or `da`; any other value is
  ignored. Then the best match in `Accept-Language` (`da-DK` gives `da`). Then English. There are no
  URL prefixes.
- **One request, one language:** the language is held in AsyncLocalStorage for that request, so
  concurrent requests can't mix.
- **The request:** the middleware's copy of the request is passed on a copy of the event, because
  `event.request` is read-only in SvelteKit 3. The event is a plain object, so the copy keeps every
  field, and form actions read their body from it.
- **`<html lang>`:** `transformPageChunk` writes the language into `src/app.html`'s
  `<html lang="%lang%">`. That attribute needs a Biome suppression comment
  (`lint/a11y/useValidLang`) just above it. The comment must not contain the `%lang%` token itself:
  `replace` swaps only the first occurrence, so the token in the comment would be filled in and the
  attribute left as it was.
- **Caching:** the middleware adds `Vary: Cookie, Accept-Language` to every response. No page is
  prerendered, since a prerendered page would have one language for everyone.
- **First in `handle`:** the language handle refuses nothing and never reads the body. Later modules
  add their stages after it with `sequence`. Errors thrown while rendering a route reach
  `+error.svelte` in the viewer's language.

**A later stage that refuses a request returns its response; it never throws.** An error thrown out
of a `handle` stage, `error(403)` included, leaves the middleware. SvelteKit then renders its
fallback page in English, without `<html lang>` or `Vary`.
A response returned from inside the chain is still in the request's language and gets `Vary`, but it
skips `transformPageChunk`, so a refusal page that a stage builds sets its own `<html lang>`. This
binds `setup`'s gate and `sign-in`'s refusals.

**In the browser,** `src/hooks.client.ts` reads the page's `<html lang>` once, when the app starts,
and makes Paraglide's `getLocale()` return it, or English if it isn't `en` or `da`. The server's
choice holds for the whole page, until it reloads. It is read once because a browser's page
translation can rewrite `<html lang>` later.
- **Why:** without the hook, Paraglide's browser runtime would choose again from
  `navigator.languages`, which needn't match the `Accept-Language` header the server saw.
- **The unasked cookie:** on its first call, the runtime would also store whatever it chose in the
  cookie. The browser's language would become a stored choice the viewer never made, and a later
  change of browser language would no longer count (D28's order).

**An accepted limit:** a tab keeps its language until it reloads. If the viewer switches language in
another tab, text that a server `load` or action returns to the first tab follows the new cookie
until that tab reloads.

## The language switcher

`src/lib/components/layout/LanguageSwitcher.svelte` is a labelled group of native buttons, one per
language, styled only with tokens. The group's label is a message. Buttons, not a `<select>` (the
owner's choice for every app, 2026-11-06): in Chrome and Edge on Windows and Linux, an arrow key on
a closed `<select>` fires `change`, so a keyboard user looking at the options would be switched and
lose focus (WCAG 2.2, 3.2.2 On Input).
- **The buttons:** each names its language in that language ("English", "Dansk"), with `lang` on
  the button. The current language's button has `aria-current="true"`, and pressing it does
  nothing. The names come from `Intl.DisplayNames`, with the first letter upper-cased in that
  language, through a helper private to the component. They are the same in every language, so they
  aren't messages, and a viewer who can't read the current language still finds their own.
- **Pressing another language** calls Paraglide's `setLocale`, which writes `PARAGLIDE_LOCALE` and
  reloads the page in the new language. The cookie has path `/`, lasts about 400 days and is
  `SameSite=Lax`. It is `Secure` exactly when the page is on `https` (`cookieSecure: "auto"`), as
  `sign-in`'s cookie rule asks.
- **Who writes the cookie:** only the browser, so it is readable by scripts, and it holds only a
  language. The server only reads it.
- **Sharing the cookie:** it keeps Paraglide's default name. Cookies ignore ports, so every app on
  the same host shares it. A choice made in one edbfi app carries over to the others there. A value
  another app wrote that isn't `en` or `da` is ignored.
- **Without JavaScript** the switcher does nothing, and the browser's preferred languages still
  apply.
- **Where it shows:** on the placeholder `/`, beside the wordmark. Each shell (PRODUCT.md's
  subscriber and admin shells) places it when that shell is built. This
  module's build names it in the landing brief's (`.impeccable/surfaces/route.md`) required
  content, beside the wordmark. It needs no brief of its own, and no other brief changes now.

### Focus

The switcher's buttons are otpravkarr's first focusable controls, so its build adds keyboard focus
as one global rule in Panda's `globalCss`: DESIGN.md's 2px `secondary` ring with a 2px offset on
every `:focus-visible` element, so later controls don't each restyle it. A ring on the component
alone would need a 2px offset that no spacing token has, which `strictTokens` refuses.

## Formatting

`src/lib/shared/i18n/format.ts` is browser-safe and formats in the current language
(`getLocale()`), on the server and in the browser alike. The language picks the `Intl` locale, not
the browser's region, so server and browser always agree: `da` formats as `da`, and `en` as `en-GB`
(the owner's choice for every app, 2026-11-06), with the day first and a 24-hour clock
("05/11/2026, 23:30"). A message's `{{name, number}}` formats as `en`, which groups numbers the same
way.
- `formatNumber(value: number, options?: Intl.NumberFormatOptions)`: `Intl.NumberFormat`.
- `formatDateTime(value: Date, options: Intl.DateTimeFormatOptions & { timeZone: string })`:
  `Intl.DateTimeFormat`.
  - **The zone is required,** so nothing is formatted in the server's or the browser's own zone by
    accident.
  - Callers pass the zone their module's spec names: the viewer's time zone where a module works in
    it (`audit-log`'s date filters, [Module notes](SPEC.md#audit-log)), or `"UTC"` for a calendar
    value such as a month's name. `i18n` adds no source for the viewer's zone; how the server learns
    it is left to the first module that needs it.

Counts and quantities inside a message use `{{name, number}}` instead. Other formatters (relative
times, lists) come with the first module that needs one.

## The message check

`src/lib/shared/i18n/messages.test.ts` holds the check and its tests. It sits in `src/` only because
Vitest runs `src/**`. The check finds every problem in a set of message files, given the project's
`locales` and base language from Paraglide's runtime, and the tests run it on `messages/*.json` and
on small in-memory files that break each rule once. It checks that:
- every language the project has has its file, and no file is for another language, which Paraglide
  would ignore without a word;
- each file is one JSON object, and every value is a non-empty string, so the files stay flat; a
  value of only whitespace counts as empty, because it renders nothing;
- every message name fits the rule above, no key contains `_ordinal_`, and no message is both one
  key and plural forms;
- English and Danish have the same messages;
- every form of a message, in both languages, has the same placeholders, names and formats;
- no placeholder has a format other than `number`. The check reads `{{name, format}}` as the plugin
  does, splitting on commas, but compares the whole format, so `{{year, number, compact}}` is
  refused where the plugin would keep only `number`;
- each plural message has exactly the forms `Intl.PluralRules(locale)` gives for each language, and
  every form contains `{{count, number}}`, named `count`;
- no value holds anything shaped like a tag: whatever the plugin reads as markup (`<b>`, `</b>`,
  `<br/>`, `<0>`), and any tag with a `name=` attribute anywhere in it, spaces around the `=`
  included (`<a href="/help">`, `<img src = "/logo.svg" />`, `<input disabled name="x">`). A tag
  with only bare attributes (`<input disabled>`) isn't reported: it has the same shape as prose such
  as `a<b and c>d`, and the plugin shows it as text rather than dropping it. Plain angle brackets
  (`1 < 2 and 3 > 2`, `<- back`, `<5 minutes (>1 channel)`) pass.

Each in-memory case breaks one clause and asserts the exact list of problems, so nothing else is
reported, and one file with several problems reports them all. The check runs in the existing
`tests` hook and in CI, so no new hook is needed.

## Validation

The build runs D29's three validations, and a concurrency check, with the pinned versions, or
cites obzorarr's evidence for two of them as the end of this section allows:
- **The pinned versions with SvelteKit 3, TypeScript 6 and Bun:** `check`, `test`, `build`,
  `smoke` and prek pass with no Node on `PATH`.
- **Building and serving through adapter-bun:** `tests/e2e/i18n.test.ts`, against the built server
  started as the secrets spec requires (`bun --no-env-file ./build`, with the generated key only).
  It also closes D16's "browser interaction with a real component". It checks that:
  - a Danish browser (Playwright locale `da-DK`) gets `/` in Danish with `<html lang="da">` and
    `Vary: Cookie, Accept-Language`;
  - pressing "English" in the switcher reloads `/` in English, writes `PARAGLIDE_LOCALE=en` with
    `SameSite=Lax` and without `Secure` over plain HTTP, and the next visit stays in English;
  - a browser with locale `fr-FR`, whose `navigator.languages` an init script sets to `fr-FR`,
    `da-DK`, gets English, the switcher marks English as current after hydration, pressing it does
    nothing, and no cookie is written. Playwright's `locale` sets both the header and
    `navigator.languages`, so only the script can split them;
  - none of these logs a console error.

  The existing smoke test keeps passing in English, Playwright's default locale.
- **A Weblate round trip:** a one-off `uv run --script` with translate-toolkit's `I18NextV4File`.
  It reads `messages/da.json` with a temporary plural message that has `{{count, number}}` and
  another placeholder, changes it, and writes it back with one tab of indentation. Weblate's
  `json_indent: 1` with `json_indent_style: tabs` sets exactly that on the same class
  (`weblate/trans/file_format_params.py`). It passes when:
  - the file parses to the same JSON before the edit;
  - Biome finds nothing to reformat;
  - Paraglide compiles the result;
  - both plural forms render.
- **Concurrency:** it passes when 200 concurrent requests in both languages against the built
  server, through a temporary route that awaits a random delay in its `load`, each render in their
  own language.

The temporary message, route and script aren't committed; the scripts and their output go in the
body of the build PR that settles each validation. The first two validations always run here, on
otpravkarr's own CI and built server. The Weblate round trip and the concurrency check may cite
obzorarr's #297 and #298 instead, but only when that PR's body shows that all of these match
obzorarr's `7368cff`: the versions of `@inlang/paraglide-js`, `@inlang/plugin-i18next`,
`@sveltejs/kit`, `@sveltejs/adapter-bun`, `typescript`, Bun, Vite and Biome, and `biome.json`,
`project.inlang/*` and `hooks.{server,client}.ts`. If anything has moved or doesn't exist yet, the
validation runs again here. So the first build PR, which has neither hook as `7368cff` has them,
runs the Weblate round trip itself.

## Weblate

Connecting Weblate is later work (D28). The round trip fixes what the component needs:
- format `i18nextv4`, monolingual;
- file mask `messages/*.json`, with `messages/en.json` as the base file;
- file format parameters `json_indent: 1` and `json_indent_style: tabs`, with keys left unsorted,
  so its commits pass Biome.

## Project structure

```text
messages/en.json  messages/da.json            the messages (repo root, where Weblate reads them)
project.inlang/settings.json                   locales and the i18next plugin
project.inlang/paraglide.config.ts             Paraglide's options, for the CLI and the Vite plugin
src/app.html                                   <html lang="%lang%">, with the Biome suppression
src/hooks.server.ts                            gains `handle`: the language handle
src/hooks.client.ts                            the browser keeps the page's language
src/lib/shared/i18n/format.ts                  formatNumber, formatDateTime (+ format.test.ts)
src/lib/shared/i18n/messages.test.ts           the message check
src/lib/components/layout/LanguageSwitcher.svelte
src/routes/(public)/+page.svelte               the placeholder's text as messages, and the switcher
tests/e2e/i18n.test.ts                         serving both languages, the switcher
```

The build also changes:
- `package.json`: the two packages, and the Paraglide compile in `prepare` and `check`, after
  `svelte-kit sync` and before Panda's codegen;
- `vite.config.ts`: the plugin;
- `tsconfig.json`: `project.inlang/*.ts`;
- `panda.config.ts`: `exclude`, and the focus rule;
- `.gitignore`: the two generated folders.

## Code style

As in [docs/SPEC.md](SPEC.md#code-style). The hooks stay thin:

```ts
// src/hooks.server.ts (the `init` hook stays as it is)
export const handle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) =>
		resolve(
			{ ...event, request },
			{ transformPageChunk: ({ html }) => html.replace("%lang%", locale) },
		),
	);
```

```ts
// src/hooks.client.ts
import { baseLocale, isLocale, overwriteGetLocale } from "#lib/paraglide/runtime.js";

// The page keeps the language the server chose for it (SPEC-i18n.md, "Choosing the language").
const lang = document.documentElement.lang;
const locale = isLocale(lang) ? lang : baseLocale;
overwriteGetLocale(() => locale);
```

## Testing strategy

- **Unit (Vitest):**
  - the message check;
  - `format.test.ts`, which runs the formatters inside `paraglideMiddleware` with a request for each
    language (the language comes from the request, as in the app), and checks that English dates
    format as `en-GB` and that `formatDateTime` follows the time zone it is given, not the
    machine's.
- **e2e (Playwright, against the built server):** `i18n.test.ts` as listed under
  [Validation](#validation); `smoke.test.ts` unchanged.
- **One-off evidence in the PR body:** the Weblate round trip and the concurrency check.

## Commands

The ground floor's commands ([docs/SPEC.md](SPEC.md#commands)). `prepare` and `check` also compile
the messages, so a fresh clone type-checks without a dev server having run.

## Boundaries

- **Always:** every user-facing string as a message in both languages (titles, labels, alt text and
  accessible names included); counts and quantities in messages as `{{name, number}}`; dates through
  `formatDateTime` with an explicit zone; messages rendered as text; refusals in `handle` returned,
  never thrown.
- **Ask first:** another language; another message format or Paraglide's URL strategy; markup inside
  messages; any dependency beyond the two packages.
- **Never:** text written into a component or service; `{{name, datetime}}` or a tag in a message;
  a prerendered page with translated text; the server writing the language cookie; connecting
  Weblate in this module.

## Docs this module changes when built

- **`docs/SPEC.md`:**
  - the status line, and row 2 of the capability map marked **Built.**;
  - the `i18n` line of "Open decisions each module closes" goes;
  - the tech-stack table gains both packages;
  - the setup fact on `prepare` and `check` gains the compile;
  - the Commands rows for `bun ci` and `check` gain the compile, and the `smoke` row names
    `i18n.test.ts`;
  - the Design tokens section gains the focus rule;
  - the testing section gains the new tests.
- **`docs/decisions.md`:** D29's "Still to validate" paragraph goes, with the outcome in the PR
  body; D16 drops browser interaction with a real component.
- **"Locale" becomes "language"** where it means the viewer's: "the viewer's language" in D28 and in
  SPEC.md's capability-map note and row 2, and "each viewer's language" in PRODUCT.md's Language
  line.
- **PRODUCT.md:** its "Rewrite state" line names `i18n`.
- **AGENTS.md:** the status and the structure tree.
- **The landing brief:** the switcher in its required content.

## Success criteria

1. The tests above pass, with `check`, `lint`, `build`, `smoke` and prek, and CI's `checks`,
   `smoke` and `ci-ok` pass.
2. The built server serves `/` in Danish to a Danish browser and in English otherwise, and the
   switcher changes it. `/healthz` is unchanged.
3. The validations have passed, with their evidence in the build PRs' bodies.
4. The docs listed above say what was built.
