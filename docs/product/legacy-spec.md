# otpravkarr

> [!NOTE]
> **Legacy product specification**, imported from the pre-rewrite documentation. It describes the
> shipped app's behaviour, which the rewrite keeps unless an approved spec or decision changes it.
> Its technology and deployment content is superseded by [`docs/decisions.md`](../decisions.md) and
> [`docs/SPEC.md`](../SPEC.md): §2 (status of the old code), §9.1 (deployment shape), the front
> listener in §9.2 and §9.4 (startup sequence).
> [`docs/research/dispatcharr.md`](../research/dispatcharr.md) records where current Dispatcharr
> behaviour differs from this text (its "Where the spec is wrong or stale" section). Decisions
> D19–D26 supersede the conflicting Dispatcharr text, including the provisioning modes (§5.2, §6.1,
> §8.3), disable-by-delete (§5.2), the "highest non-admin" user level (§3, §6.5, §10), the health
> probe and the §7.3 plugin rows. D31 supersedes the master secret's formats and its per-purpose
> keys (§9.2, §10). Sections are deleted as approved `docs/SPEC-<id>.md` files cover them, and the
> file goes once nothing is left (AGENTS.md, cleanup procedures).

Plex-gated user provisioning and per-user IPTV access for Dispatcharr.

The name comes from the Russian word for "dispatch" or "sending", with the "-arr" suffix common to self-hosted media tooling. The product is a small bridge: it lets the people a Plex server owner has shared with (their accepted Plex friends) sign in with Plex and receive their own, scoped IPTV streaming account on a Dispatcharr instance, without the owner ever creating accounts by hand.

## 1. Purpose

### The problem

Dispatcharr turns provider IPTV sources into a curated channel catalogue and serves it over standard player protocols (Xtream-Codes style playlist and API URLs, an XMLTV guide, live stream URLs). What it does not do is manage *who* may use it in a convenient, Plex-shaped way. A server owner who already shares a Plex library with a circle of friends has to create Dispatcharr accounts manually, hand out passwords, remember to delete accounts when a friendship ends, and work out how to restrict each person to a sensible subset of channels.

otpravkarr solves exactly that slice:

- **Plex is the identity and authorisation source.** Being an *accepted* Plex friend of the server owner is the entitlement. Pending invites grant nothing. When the friendship ends, access ends.
- **Dispatcharr is the single source of truth for channels.** otpravkarr never creates channels or groups; it only creates per-user accounts and the channel-profile scaffolding that limits what each account can see.
- **Least-privilege lineups.** Each subscriber sees only the channel groups they are entitled to under an admin-defined policy; a subscriber with zero groups sees zero channels, never "everything".
- **Self-service portal.** A friend signs in with Plex, optionally picks their channel groups, and receives playlist, guide and player-API URLs, a QR code, a downloadable playlist snapshot, and install guidance for recommended player apps.
- **Continuous reconciliation.** A background sync keeps local records, Plex friendships, Dispatcharr accounts and channel-profile membership converged, and tolerates the churn introduced by Dispatcharr plugins that rename, regroup, quarantine or hide channels.

### Who it is for

A single self-hosting Plex server owner (the administrator) and a small circle of trusted friends (the subscribers). It is not a multi-tenant or commercial IPTV panel.

### Where it sits in the stack

Upstream of it: Plex (plex.tv account services and the owner's Plex Media Server) and Dispatcharr (and, indirectly, the Dispatcharr plugins installed there). Downstream: the players people use (FredTV, IINA, VLC or any Xtream-Codes-capable IPTV player). otpravkarr sits in the middle as a web application with an admin console, a user portal and a background scheduler, typically on the same private network as Dispatcharr and behind the operator's reverse proxy.

### What it deliberately does not do

- It does not proxy or serve video. Streams always come straight from Dispatcharr's public address.
- It does not create, rename, number, map or delete channels, groups or EPG data. Those belong to Dispatcharr and its plugins.
- It does not change, enable, disable or run Dispatcharr plugins. Plugin integration is strictly read-only and advisory (an earlier version wrote one plugin setting; that was removed on purpose).
- It does not generate its own XMLTV guide; subscribers use Dispatcharr's native, profile-scoped guide URL.
- It does not store subscribers' Plex tokens, does not send email or notifications, and does not import friends in bulk. A friend gets an account the first time they sign in.
- It does not expose a public API beyond a coarse health endpoint; everything else is session-gated.

## 2. Status

**Shipped and in production use.** Around 200 commits over roughly seven months, with repeated multi-day "dogfood" audits (accessibility, security, end-to-end behaviour) whose findings were fixed in numbered batches. A curated-lineup rollout (lineup policies, bundles, event-channel handling) was deployed against a live Dispatcharr instance with recorded rollback drills. Everything described below exists in code and has unit, component and browser-level tests unless explicitly marked otherwise.

Parts that are present but *not* wired into the UI, or are documented differently from how they behave, are called out in section 12 so the rewrite team knows what was validated in practice.

## 3. Product feel and goals

### Intended experience

Two very different audiences get two very different surfaces:

- **The admin console** is dense, operational and honest. Tables with small type, filter chips whose state lives in the URL so views can be shared, status badges everywhere, relative timestamps ("5m ago"), an always-visible audit trail, and action dialogs that spell out consequences before you confirm ("The Dispatcharr account will be deleted and all stream URLs will stop working immediately. The local mapping is retained so the user can be re-enabled later.").
- **The subscriber portal** is calm and single-column (about 42rem wide), with one big serif headline ("Stream access.", or the person's own Plex name), masked credential fields you reveal or copy only when you need them, a QR code generated only on click, and a short setup guide per player app. The tone is reassuring and consequence-aware ("Continuing with zero groups means your player will show no channels.").

### Visual direction

The theme is called **Dark Matter**: dark-first, near-black surfaces with a faint purple cast, a warm orange brand colour (dark text on orange buttons), teal as a secondary, and a real red reserved for destructive actions. Dark mode adds a subtle film-grain texture; sign-in heroes have a soft orange radial glow behind the headline and the primary button glows faintly. A light mode exists with a darker orange tuned for readable button text, but there is no visible toggle; dark is the default and the intended look.

Typography is editorial: a modern variable sans for body text with slightly tight letter spacing, a monospace face for URLs, tokens, IDs and timestamps, and a display serif for page headlines. Headlines are short sentences that end in a full stop ("Welcome back.", "Overview.", "System configuration."). Section labels are tiny, uppercase, widely letter-spaced eyebrows ("DASHBOARD", "YOUR STREAM", "RECOMMENDED"). Corners are generously rounded. Hero sections fade in and rise with a short stagger; all motion respects the user's reduced-motion preference.

The product name is always lowercase "otpravkarr". Page titles follow the pattern "Page — otpravkarr".

### Opinionated choices and why

- **Fail closed on exposure.** The whole design is shaped by one fact about Dispatcharr: a user whose channel-profile list is empty sees the *entire* catalogue, and a freshly created profile starts with every channel enabled. otpravkarr therefore maintains a real, zero-channel "empty profile", never writes an empty profile list, narrows every new profile before assigning it, refuses to scope admin-level Dispatcharr users, and tears down an account it could not scope. "Zero groups means zero channels" is a product promise, not an accident.
- **Dispatcharr owns the catalogue; otpravkarr owns only assignment.** Subscriptions are keyed on stable numeric group and channel IDs, never names, so plugins may rename and regroup freely. The app owns exactly two things in Dispatcharr: which profiles each of its users is assigned, and the membership of the profiles it created (recognisable by a name prefix). It never modifies a profile it did not create.
- **Intent is separate from effect.** What a user or admin *chose* (policy override, bundles, approved picks) is stored separately from what they *currently get* (the materialised group list). Resolution only ever narrows; a group that disappears, is quarantined or loses approval drops out of effect but the intent is retained and comes back when conditions return. Nobody's access silently widens.
- **Pending is not accepted.** Only accepted Plex friendships grant access. A mapped user whose friendship shows as pending is treated as removed.
- **Honest, explain-the-consequence copy.** Confirm dialogs, warnings and empty states say what will happen and why. Help text documents quirks ("Downloaded M3U files are best-effort snapshots and do not update automatically").
- **Secrets stay masked by default.** Credentials are shown masked; QR codes (which contain credentials) are never rendered until the user asks; one-time passwords are shown exactly once.
- **Degrade, don't hang.** Interactive page loads talk to Dispatcharr with short timeouts sized to beat the server's idle-socket window, and render a degraded view (table without drift badges, "unreachable" plugin page) rather than a blank error. Background work uses longer timeouts with retries.
- **Everything mutating is audited**, including setup steps, with the acting admin and client address where known.
- **Localised to British English only**, with en-GB date formatting; one subscription string assumes a Danish core lineup, reflecting the original deployment.

## 4. Users, roles and permissions

| Role | How they authenticate | What they can do |
|---|---|---|
| **Anonymous visitor** | — | See the portal sign-in page, the admin login page and the public coarse health endpoint. Before first-run setup is complete, everything else redirects to the setup wizard. |
| **Administrator** | Username + password on the login page, *or* signing in with Plex on the portal as the Plex account that owns the configured admin token (the server owner) | Dashboard, user management, settings, plugin advisories, audit log, manual sync, credential rotation, internal health and friends APIs. There is exactly one admin account, created in setup. |
| **Subscriber (portal user)** | Sign in with Plex; must be an accepted friend of the server owner | View their own credentials and URLs, download their playlist snapshot, refresh (rotate) their own credentials, choose channel groups or bundles where policy allows, sign out. |
| **Revoked subscriber** | Has a session but their mapping is inactive | Sees only a "your access has been revoked" view and a sign-out button. Never reaches credential-serving pages or actions. |
| **Plex server owner as subscriber** | Same Plex identity as the admin | May create a separate, non-admin "self-subscription" account from the admin console ("Subscribe myself"), which then behaves like any other subscriber and is excluded from friend-sync reaping. |

Admin and subscriber sessions are distinct types; an admin session is refused on subscriber-only actions and vice versa. Admin APIs answer "unauthenticated" with no session and "forbidden" with a subscriber session.

## 5. Domain model

### 5.1 Entities

| Entity | Purpose | Identity and key rules |
|---|---|---|
| **Instance settings** | Key/value configuration for the single instance (connection details, policy defaults, setup state, quarantine names, intervals). Some values are stored encrypted. | One value per key; writing replaces. There is no delete; clearing means writing an empty value. |
| **User mapping** | The central record: one Plex identity linked to (at most) one Dispatcharr account, plus the user's access rules and lifecycle flags. | Unique per Plex account ID. The Dispatcharr user ID is indexed but *not* unique (defensive: drift can produce duplicates, and rotation refuses to act on shared IDs). |
| **Admin account** | The single local administrator login. | Unique username; password stored as a salted hash. Create-only; no update or delete path exists today. |
| **Session** | A login session for an admin or a subscriber. | Random opaque token (also the cookie value), a type (admin or user), a reference (admin username or mapping ID), absolute expiry. Several concurrent sessions per person are allowed. |
| **Audit entry** | Append-only history of significant events. | Timestamp, action name, optional actor, optional client address, optional structured detail. Never edited; only pruned by retention. |
| **Group profile record** | For each Dispatcharr channel group, the otpravkarr-owned Dispatcharr channel profile containing exactly that group's channels; plus one special record for the shared empty profile. Also stores the "known channel" snapshot used for event groups. | Keyed by group ID; the profile ID is unique so one profile never serves two groups. The empty profile uses a sentinel group key. Global, not per user. |
| **Lineup bundle** | A named, ordered set of channel groups a subscriber can opt into under the "core plus bundles" policy. | Permanent ID and permanent slug (immutable once created; identity is never derived from the display name). Display name, enabled flag and group list are editable. |
| **Migration record** | Bookkeeping of applied schema versions. | Ordered versions, applied once, all-or-nothing per batch. |

### 5.2 User mapping in detail

A mapping carries three families of data:

1. **Plex identity**: numeric account ID (the login key), Plex's secondary opaque account identifier, username, email, avatar URL. Refreshed from Plex on every sync.
2. **Dispatcharr linkage**: remote user ID, remote username, the encrypted Xtream-Codes streaming password (only for automatically managed accounts), the assigned profile ID (only meaningful for the empty profile), and the **materialised effective group list** (what the user can see right now).
3. **Rules and state**: provisioning mode, active flag, owner flag (marks the owner's self-subscription), group-selection lock, lineup policy override, selected bundle IDs, selected approved group IDs (the last three are **intent**), timestamps for creation, update, last sync and last portal access.

**Provisioning modes**

| Mode | Meaning |
|---|---|
| Automatic (default) | otpravkarr creates and owns the Dispatcharr account and its streaming password; the portal can show and rotate credentials; subscriptions are enforced. |
| Self-managed | otpravkarr creates the account and shows the initial password once; the person then manages it in Dispatcharr directly. No stored password, no credential portal. |
| Staff | Like self-managed but the Dispatcharr account is flagged as staff. Skipped by subscription sync. |

**Lifecycle states.** A mapping is either **active** or **inactive**; there is no separate "suspended" state. Independently, it either has a Dispatcharr account or not. The combinations the UI names are:

| Shown as | Active? | Has remote account? | How it arises |
|---|---|---|---|
| Active | yes | yes | Normal provisioned subscriber |
| Orphaned | yes | no | Remote account deleted outside the app (detected by sync) or a mapping that was never completed |
| Inactive | no | either | Disabled by an admin, reaped by sync when the friendship ended, or torn down after a failed scoping |

Transitions:

- **Provision** (sign-in or admin action): creates the remote account and the mapping, or reactivates an inactive mapping (see 6.4).
- **Disable**: deletes the remote account (Dispatcharr has no "inactive" user flag, so disabling *is* deleting), clears the remote linkage and stored password, marks inactive, keeps the Plex identity so the person can come back.
- **Enable**: only for inactive mappings whose remote account still exists; otherwise the admin path re-provisions.
- **Permanent delete of the local mapping**: allowed only when there is no remote linkage and no stored password; removes the mapping and the person's portal sessions. The person can sign in again later and be provisioned afresh.
- **Credential rotation**: automatic mode only; new password on both the Dispatcharr account password and the streaming password, stored encrypted locally.

### 5.3 Invariants

- One mapping per Plex account. Re-provisioning an existing (inactive) mapping updates it; it never inserts a second row.
- A mapping's effective group list is only ever written by the single subscription-enforcement path, and only after the remote write succeeded.
- Intent fields are never modified by resolution or sync; only by the user (portal) or the admin.
- The group-profile table never points two groups at one profile; the empty profile has its own sentinel entry.
- Bundle ID and slug are immutable (enforced at the storage level).
- Audit entries about a user carry both the Plex username and the Dispatcharr username so the actor/user search can find them; the Dispatcharr username recorded is the one *verified from the remote side*, never a possibly stale local copy.

## 6. Core behaviours and workflows

### 6.1 First-run setup

**Bootstrap token.** On the first request after start, if setup is not complete, the server prints a banner to its log: a one-time token of three groups of four lowercase letters or digits, the setup URL, a note that the token expires in 15 minutes, and a warning that a restart (or a different worker) invalidates it. The token lives only in process memory. A token placed in the URL is ignored; it must be typed.

**Claiming.** The wizard's first step asks for the token. A valid token gives this browser a *setup claim*: a short-lived (10 minutes, renewed by every wizard action), cookie-bound, encrypted proof stored server-side. Every later wizard step requires the claim. The claim is deliberately shorter than the token so an abandoned claim can be re-claimed with the same token. Claiming while another browser holds an active claim is refused with an explanation; if no admin exists yet, the page tells the stranded person the local time at which re-claiming reopens, and that restarting the server mints a fresh token. Future-dated claim timestamps are distrusted so clock skew or tampering can never extend the lockout. Claim and recovery attempts share a per-client rate limit (5 per 15 minutes).

**Recovery.** If an admin account already exists (an earlier setup was interrupted), the default view is "Resume setup": sign in with the admin credentials to regain the claim and continue from the first unfinished step. This is also the escape hatch when the claim cookie was lost (browser back, closed tab, expiry).

**Steps.** Claim → Admin → Plex → Dispatcharr → Origin → Defaults, with a progress indicator and the ability to go back without losing typed values.

1. **Admin account.** Username 3–32 characters (letters, digits, underscore, dash), password at least 12 characters with a live strength meter and confirmation. A second admin can never be created.
2. **Plex.** Either paste a server URL and token, or "Sign in with Plex" in a popup. After popup sign-in the app discovers the account's servers, ranks each server's connections (remote HTTPS first, then local HTTPS, then local HTTP, with loopback/container-internal addresses deprioritised and relay last) and offers a picker; if discovery fails, manual URL entry is offered. Validation connects to plex.tv with the token, connects to the server, requires a friendly name and machine identifier, and requires that the token's account actually has access to that machine. Transient failures are retried with backoff and a live elapsed-seconds counter; bad-token, bad-request and not-found failures are not retried. On success the server name, machine ID and version are shown. The stored machine ID is whatever the server itself reports.
3. **Dispatcharr.** Internal URL (used for all API calls), optional external/public URL (used only for the URLs handed to subscribers), and API key. A single fast connection test distinguishes "could not connect" from "API key is invalid". In the background the step also probes whether an Xtream-Codes-style surface exists at the internal address.
4. **Allowed origins.** A comma-separated list of browser origins allowed to submit changes, pre-filled with the current one. Origins must match exactly including scheme and port.
5. **Defaults.** A default channel group (dropdown, quarantine groups excluded), a default profile ("All channels" or one profile), sync interval in minutes (1–1440, default 15) and a default provisioning mode (automatic or self-managed). If an Xtream-Codes surface was detected, its URL template is shown.

**URL rule (Plex and Dispatcharr).** Because these URLs carry secrets, they must be HTTPS; plain HTTP is allowed only for loopback hosts. Only web schemes are accepted, and the value is reduced to its origin (any path is dropped).

**Completion** marks setup complete, releases the claim and clears the bootstrap token, seeds the health state as healthy, replaces any prior session with a fresh admin session, audits "setup completed", and lands on the dashboard. Each wizard step is itself audited as a configuration change (with secret values omitted). After completion the setup page returns "not found".

### 6.2 Admin authentication

- Password login is rate-limited per client address (5 attempts per 5 minutes). When limited, the page shows a live countdown and then "You can now try again." Unknown user and wrong password produce the same message. A successful login first deletes whatever session the browser's cookie named (anti-fixation), then issues a new 1-hour admin session and audits the login. Failed attempts are not audited.
- **Owner sign-in through Plex.** There is no Plex button on the login page. When someone signs in with Plex on the portal and their Plex account ID equals the account behind the stored admin token, they are signed in as the admin with no password and sent to the dashboard. Because the final hop is a cross-site navigation back from Plex, the admin cookie is issued once with the relaxed same-site attribute and reverted to strict on the very next request; a test guarantees this relaxation is used in exactly one place.
- Sessions slide: each request extends the admin session to one hour from now and the subscriber session to four hours. Sign-out deletes the session, audits an admin logout, and returns the person to the login page (admins) or portal home (subscribers). An already-signed-in admin visiting the login page is sent to the dashboard.

### 6.3 Subscriber sign-in and onboarding

1. **Start.** The portal's "Sign in with Plex" (rate-limited: 20 per 15 minutes per client address) asks Plex for a web-login PIN, remembers the pending login in process memory for 10 minutes under a random ID, stores that ID in a short-lived cookie, and redirects only to Plex's official app domain. Starting is retried a few times with backoff for transient connectivity failures (common on hosted servers); exhaustion yields a distinct "we're having trouble reaching Plex services" message.
2. **Return URL.** Built from the configured public origin. If the configured origin is a loopback address and the request arrived on an *equivalent* loopback host with the same scheme and port, the request's actual host is used so the callback lands on the same host and cookie scope; a mismatched loopback request is overridden by the configured origin (and logged), so a spoofed host header cannot steer the callback. The setup wizard's own Plex popup instead uses the request origin so its window-to-window handshake works.
3. **Callback.** The cookie is consumed once and deleted; the pending login is completed (polling Plex for the authorised token), the identity (account ID, secondary identifier, username, email, avatar) is extracted, and the pending entry is removed so the ID cannot be replayed. The subscriber's Plex token is used only here and never stored.
4. **Authorisation.** If the identity is the server owner → admin session (see 6.2). Otherwise the owner's friends list is fetched fresh (never from cache) and the identity must appear with status *accepted*; otherwise "Your Plex account does not have access to this server". An existing but inactive mapping yields "Your access to this server has been revoked".
5. **Group picker for new friends.** A brand-new friend is shown a pre-credential channel-group picker *only when* the instance policy is "approved selection", self-selection is allowed, and there is at least one offered group. The verified identity is carried across this step in a sealed (encrypted, tamper-evident, 10-minute) cookie that does not contain the Plex token. The picker is refresh-safe and keeps the selection on error. On confirm, the server re-verifies friend status, re-checks that self-select is still allowed, and re-validates every chosen group against the server-computed offered set (fail closed) before provisioning. Returning users, the owner, other policies, self-select disabled and "no offered groups" all bypass the picker so nobody is stranded.
6. **Provision and session.** The person is provisioned (6.4) with the default mode, and a 4-hour subscriber session replaces any prior session in the cookie. If a password must be shown once (self-managed and staff modes), it is carried in a sealed 2-minute cookie and displayed on the next portal view exactly once.

### 6.4 Provisioning a Dispatcharr account

Provisioning is idempotent by Plex account ID and never throws for expected failures; it returns one of *provisioned* (optionally with the initial password), *already exists*, *reactivated* or *failed*.

- **Existing active mapping** → already exists; Dispatcharr is not contacted.
- **Inactive mapping that still has a remote account** → reactivation: confirm the remote user still exists; if it is gone, clear the stale linkage and fall through to creation. For automatically managed accounts, put the *stored* streaming password back onto the remote account (merging into its existing custom properties rather than replacing them) so bookmarked URLs keep working and older accounts created without that property are repaired. Only after that succeeds, mark active and audit "provisioned (reactivated)". Then enforce the subscription; if enforcement fails, delete the remote account, mark inactive, write a compensating "disabled" audit entry and report failure (noting a live orphan if the delete itself failed).
- **No mapping, or inactive with no remote account** → creation:
  - **Username**: the Plex username reduced to lowercase ASCII letters and digits (or a generic fallback if nothing remains), then the first free candidate among the base name and numbered suffixes, checking both local mappings (case-insensitively) and Dispatcharr's exact-username lookup. A remote lookup failure is logged and treated as "free" (local-only de-duplication). After a very large number of collisions a time-based suffix is used.
  - **Password**: 24 random letters and digits from a cryptographically secure source. For automatic mode it is encrypted *before* anything remote happens, so an encryption failure can never leave an orphan.
  - **Remote create**: the user, with the password set as both the Dispatcharr account password and the Xtream-Codes streaming password property (without the latter, the Xtream endpoints reject the user). Staff mode sets the staff flag.
  - **Local write**: update the existing inactive row or insert a new one; audit "provisioned" with the acting admin (or the Plex username for self-service) and client address. If the local write fails after the remote create, failure is reported and the remote account is left behind (known gap).
  - **Enforce** the subscription for the groups the caller supplied. A new remote user has an empty profile list (meaning "everything"), so this step is mandatory. Failure tears the account down as above.
- The initial password is returned to the caller for self-managed and staff modes (nothing is stored), and for automatic mode only on explicit request (admin re-provisioning).

The provisioner applies whatever group list it is given; it does not consult policy. Callers that want access to survive the next sync must also save consistent intent (the admin and onboarding paths do).

### 6.5 Subscriptions and the "one profile per group" model

A **subscription** is the set of Dispatcharr channel groups a user may see. It is enforced as follows ("Model A", verified against Dispatcharr's own behaviour):

- otpravkarr owns one Dispatcharr channel profile per subscribable group, named with an owned prefix, the group ID and the group's display name (commas replaced, whitespace collapsed, truncated to Dispatcharr's name limit). Ownership is recognised by prefix plus group ID so renames are harmless.
- It also owns one shared **empty profile** with zero channels enabled.
- A user's profile list is set to exactly one profile per subscribed group (Dispatcharr shows the union), or to the empty profile for zero groups. The list is **never empty**.
- Every subscriber is set to Dispatcharr's highest *non-admin* user level, because admin-level users bypass profile filtering entirely. A remote user already at admin level is refused ("provision a separate non-admin subscriber").

**The single enforcement path** (used by provisioning, admin edits, portal saves and sync):

1. Validate: mapping exists, has a remote account; group IDs are positive whole numbers, de-duplicated and sorted; otherwise a validation error before any network call.
2. Look up the remote user under an interactive deadline (about 8 seconds, chosen to stay inside the server's idle-socket window); refuse admin-level users.
3. Resolve profiles against **live** remote state (a locally recorded profile ID is never trusted without checking): fetch all channels and bucket them by effective group (override first, base group second; ungrouped channels can never be subscribed); fetch all groups and require every requested ID to exist; reconcile each group's profile:
   - if a local record exists, fetch that profile; if it exists and carries our prefix, use it (migrating away from legacy comma-bearing names by adopting or creating a comma-free replacement and leaving the old one untouched); if it is gone or the ID now belongs to a foreign profile, do not touch it — adopt or create ours and repair the record;
   - "adopt or create" first scans existing profiles for one with our prefix and group ID (handles a reset local database or a renamed group), gives up rather than risk a duplicate if the scan fails, and otherwise creates the profile, adopting by exact name on a name collision;
   - then narrow membership: compute the desired channel set, send only the difference (enable missing, disable extra) in one bulk update, or make no call if nothing differs; then save the group's full desired channel set as its **known-channel snapshot**;
   - the empty profile is ensured by exact name and has any drifted-in channels disabled again.
4. Write the user's profile list and user level in one update whose request timeout equals the deadline, so a late write is aborted rather than landing after the caller gave up.
5. Only then write the materialised group list locally and a best-effort "group changed" audit entry (before/after). An audit failure is logged but never turns a correct subscription into a failure, because in provisioning that would trigger teardown of a correctly scoped user.

No code path ever deletes a channel profile. Profiles the app does not own are never modified.

### 6.6 Lineup policies: from intent to effective access

Policies implement least privilege on top of subscriptions.

**Instance settings**: a default policy (one of the three below; the shipped default is "core plus bundles"), the fixed group list, the core group list, the approved group list, a bundle catalogue (bundles with ID, slug, display name, enabled flag, ordered group IDs) and a catalogue version number the admin increments when changing bundle contents. The approved list is deliberately *not* seeded: unset or malformed means **nothing is approved**, which fails closed rather than exposing all live groups.

**Per-user intent**: optional policy override, selected bundle IDs, selected approved group IDs, and a group-selection lock.

| Policy | Requested groups |
|---|---|
| Fixed | The instance's fixed list; the user has no choice |
| Core plus bundles | The core list, plus the groups of every *enabled* bundle the user selected |
| Approved selection | Exactly the approved groups the user (or admin) picked |

**Effective groups** = requested groups, minus anything not live in Dispatcharr, not on the approved list, or quarantined; de-duplicated and sorted. An unset approved list yields nothing. Resolution never changes stored intent; malformed intent reads as empty.

**Offered groups** (what pickers show a given user) = live groups on the approved list that are not quarantined. A new user's default selection is "all offered". Self-selection is allowed unless the instance explicitly disables it; a per-user lock additionally freezes that user's selection (the portal then shows a read-only "managed by your administrator" view).

Where policy is applied: onboarding (new friends), the portal's "My channels" page, the admin's "Change Group" dialog (which saves intent first, then re-resolves and enforces), and every sync (which recomputes from intent for every active, non-staff subscriber — including the owner's self-subscription — and never from the materialised list).

### 6.7 Quarantine groups

Dispatcharr's IPTV Checker plugin moves dead, black-screen and low-framerate channels into quarantine groups (factory names "Graveyard", "Black Screens" and "Slow", renameable by the admin). otpravkarr never offers quarantine groups, never includes them in effective access, and excludes them from every picker. Matching is by trimmed, case-insensitive name.

To survive renames, every sync reads the plugin's three destination-group settings and replaces the plugin-derived names wholesale, always unioned with the three built-in names (a permanent floor). The matcher **never narrows** on missing information: if the plugin list cannot be read, the plugin is absent or disabled, or it reports no usable names, the previous matcher is kept. The resolved state is persisted (best effort) and reloaded at startup so renamed junk groups stay hidden before the first sync. Quarantine does not apply to users; a user's intent pointing at a quarantined group is simply ineffective until the group leaves quarantine.

### 6.8 Event groups and Event Channel Managarr

Groups and profiles whose names end in " — PPV/Events" or " — Unscheduled Events" are **event groups**, whose channel *visibility* is owned by the Event Channel Managarr (ECM) plugin on a schedule. otpravkarr must add newly imported event channels to its event-group profiles without re-enabling channels ECM deliberately hid. It does this with the known-channel snapshot: for an event group, channels that were in the snapshot but are currently disabled in our profile are assumed ECM-hidden and stay disabled; channels not in the snapshot (new arrivals) are enabled; channels that left the group are disabled; an empty or absent snapshot enables everything currently in the group. A corrupt snapshot fails closed for that group (no changes) before any remote call. Ordinary groups always receive exact membership.

The sync's final step is a **read-only ECM scope check**: it reads ECM's comma-separated "profiles in scope" setting, works out which of otpravkarr's safe (comma-free) event-profile names are missing from it, and reports the reason (plugin absent, disabled, no owned event profiles, or fully covered). The admin plugins page turns this into warnings telling the operator what to add in Dispatcharr. otpravkarr never writes plugin settings, never runs, enables or disables a plugin, and a test fails if any such call appears in the enforcement or check code.

### 6.9 The sync (full reconcile)

The scheduled job and the dashboard's "Run sync now" both run the same four-step sequence under one exclusive lock (a scheduled tick that finds it running is skipped and logged; a manual trigger gets "sync already in progress"). Steps 2–4 are each isolated so one failure never stops the next; if step 1 throws, the run fails as a whole.

1. **Friend and user sync.** Resolve the owner's account (retried), fetch friends (retried). If either fails, record the error, still write the completion audit entry, and stop. Otherwise load all mappings, drop the owner's own mappings and the owner from the friend list, keep only *accepted* friends, and for each mapping:
   - **No longer an accepted friend**: if it has a remote account, run disable even if the row is already inactive (the remote account may have drifted back); if it has no remote account but is active, mark inactive, clear credentials and audit; counters move only on real state changes.
   - **Still a friend**: refresh the Plex username (preferring username, then title, then friendly name), email and avatar if changed; if it has a remote account, verify it (not found → mark orphaned by clearing the linkage and deactivating; other errors → record; success → copy any changed remote username); stamp last-synced unless verification failed.
   - Accepted friends with no mapping are only **counted** as unmapped; sync never provisions anyone.
   - Exactly one "sync completed" audit entry per run, with the flat report (unmapped, disabled, orphaned, refreshed, errors), written by this step only.
2. **Quarantine refresh** (6.7) — must precede subscriptions so renamed junk groups are hidden in the same cycle.
3. **Subscription sync** (6.6) for every active, non-staff subscriber with a remote account; per-user failures are recorded and skipped.
4. **ECM scope check** (6.8), last so it can see any freshly created profiles.

Manual runs additionally audit "sync started" with the admin as actor and respond with the step-1 report; the other step results go to the structured log. Scheduled runs audit "sync started" with no actor. "Sync failed" is audited only when the whole sequence throws. If the Dispatcharr URL, API key or Plex admin token is missing, the run is skipped with a log naming the missing items (manual: "cannot run: missing configuration").

**Cadence**: default every 15 minutes, configurable 1–1440 minutes (saving in Settings reschedules immediately). Jobs fire at fixed rate from the previous *scheduled* time, skip missed runs instead of bursting after a stall, never run concurrently with themselves, and log errors without crashing the scheduler. No job runs immediately at startup; the first sync happens one interval after boot. On shutdown the scheduler cancels timers but does not wait for a running job.

### 6.10 Admin lifecycle actions

- **Rotate credentials** (automatic mode, has remote account, active, and no other mapping shares the Dispatcharr ID): generate, encrypt first, look up the remote user, update both passwords (merging custom properties) under the interactive deadline, then a *guarded* local write that only succeeds if the row still has the same ID, remote ID and mode; audit with the verified remote username. Remote "not found" cleans up the stale mapping; a local write failure after a remote success reports possible inconsistency. The admin is never shown the new password; the subscriber sees it in the portal. Subscribers can also rotate their own credentials ("Refresh Credentials") with the same rules, audited with themselves as actor.
- **Disable / Enable / Re-provision**: as in 5.2. Enabling a user whose remote account is gone re-provisions them and re-applies their saved policy; if a new password comes back the one-time-password dialog opens.
- **Change Group**: edit policy override, bundle selection and approved picks; a separate "lock selection" toggle saved independently; a summary of effective policy, effective groups and any unapplied intent; a warning when the result is empty; live drift indicator (remote profiles differ from stored selection).
- **Change Profile**: assign one Dispatcharr profile directly. For managed subscribers this is disabled with an explanation (it would be reverted by the next sync) and "unrestricted profile clearing" is never offered; blank or invalid overrides are rejected before any write.
- **Delete local mapping**: only when disabled and credential-free; transactional with session deletion; audited best-effort.
- **Subscribe myself**: provisions the owner's separate non-admin subscriber account (idempotent; explains if it already exists).

### 6.11 Credentials, URLs and the playlist snapshot

For automatically managed subscribers the portal derives everything from the Dispatcharr username, the decrypted streaming password and the **public base URL**: the external URL if set, otherwise the internal URL — in both cases only if it passes the HTTPS-or-loopback rule. An external URL that fails the rule yields *no* URL (no fallback to internal), and the portal explains that an HTTPS public URL is required.

Artefacts: an Xtream-Codes playlist URL, a player-API URL, an XMLTV guide URL (Dispatcharr's native, profile-scoped guide), and a per-channel live-stream URL used inside the downloadable snapshot. Credentials are inserted raw (generated passwords are alphanumeric by design so no encoding is needed). The playlist URL is what the QR code encodes.

**Playlist snapshot download**: a file named after the username, never cached, containing only channels in the user's selected groups (same effective-group bucketing as enforcement; malformed selection means none), channels without a number dropped, sorted by channel number, names sanitised. An empty selection yields a header-only file. The portal states clearly that snapshots do not update; the real access boundary remains Dispatcharr's per-user profiles at stream time. Refused for non-automatic users, unprovisioned users and anonymous or revoked sessions.

### 6.12 Health

An in-memory health state starts pessimistic, is probed once during startup, then every 5 minutes, and is set to all-healthy when setup completes.

- **Plex**: healthy, unauthorised, unreachable or "server changed" (machine ID differs from the stored one). A plex.tv outage with a working local server still counts as healthy.
- **Dispatcharr**: reachable and auth-valid flags. A reachable result (including a definitive "auth invalid") is published immediately; an unreachable result is published only after **two consecutive** failed probes, so a single blip keeps the last known good state. Every failed probe is still audited.
- **Local database**: a write-then-read-back check.

Overall status: unhealthy if the database check fails; ok if all three are good; otherwise degraded (a fresh instance is "degraded"). The public health endpoint returns only that one word; the admin-only health endpoint adds per-check detail and uptime (no version string, by decision).

### 6.13 Housekeeping jobs

- **Session cleanup** every 30 minutes removes expired sessions.
- **Audit rotation** daily removes entries older than the retention period (default 90 days, admin-configurable, read on every run).

## 7. External integrations

### 7.1 Plex

- **Auth style**: the admin's Plex token (stored encrypted) for owner-side calls; per-session PIN-based web sign-in for everyone else; subscribers' tokens are never persisted.
- **Read**: the owner's account (for owner detection and server validation), the owner's resources/servers (setup discovery and token-to-server access check), the owner's friends list with status (sync and portal authorisation), and server identity (health). Nothing is written to Plex.
- **Polling vs push**: pull only. Friends are fetched fresh for each portal sign-in and each sync; a 15-minute in-memory friends cache feeds only the dashboard's "available friends" card and the admin friends API.
- **Failure handling**: malformed friend data fails closed; transient connectivity failures are retried with backoff; sign-in start distinguishes "Plex unreachable" from other errors; portal loads that hit Plex failures return a controlled gateway error rather than a generic crash. All pending/completed sign-in state is per-process memory and lost on restart.

### 7.2 Dispatcharr

- **Auth style**: one long-lived API key sent on every request; stored encrypted; no refresh. The internal URL must be HTTPS or loopback so the key never crosses cleartext on a LAN.
- **Read**: users (list, exact-username lookup, get), channel groups, channels (large pages because small pages timed out), channel profiles and their membership, plugins and their settings, and a minimal probe for health.
- **Write**: create user, update user (profile list, user level, passwords, custom properties — always merged), delete user, create profile, bulk-update profile membership. Never: delete profiles, touch channels or groups, touch plugins.
- **Two client profiles**: *robust* (15-second timeout, one retry for safe reads, none for writes; used by background jobs, provisioning, credential serving, health) and *interactive* (short timeout derived to stay below the server's idle-connection window, no retries; used by page loads and connection tests).
- **Pagination**: envelope-or-flat-array tolerant; "next" links are re-based onto the configured host so the key is never sent elsewhere; any page failure fails the whole fetch (no partial results).
- **Validation posture**: responses are schema-checked and fail closed; in particular a profile membership that is not a proper list is an error, never "empty" (an empty "current" list would make narrowing a no-op and silently expose the catalogue). Plugin payloads are parsed leniently because their shape is undefined.
- **Error classification**: auth failure, not found, validation error, server error, network error, unexpected shape; mutations are marked non-retryable; response bodies never reach user-facing messages and are redacted in logs.

### 7.3 Dispatcharr plugins (read-only advisories)

Detection matches each installed plugin by its key; unknown plugins appear generically. Each known plugin has a one-line description and advisories (info or warning) shown on the admin plugins page:

| Plugin | Role in the ecosystem | otpravkarr's stance |
|---|---|---|
| Event Channel Managarr | Toggles visibility of existing event channels per profile on a schedule and after playlist refresh; never creates channels | Reports which of our event profiles are missing from its scope; warns about comma-bearing names it cannot list; never changes its settings |
| IPTV Checker | Probes streams, moves dead/slow/black-screen channels into quarantine groups | Quarantine groups are hidden from all pickers; names are learned live and never narrowed |
| Stream Mapparr | Matches streams to channels and toggles channel visibility | Owns the enabled flag in its profiles; we own only our group profiles and user assignment and do not fight it |
| Channel Mapparr | Standardises names, imports playlists, creates and reorganises groups | Tolerated: we key on stable IDs, never names |
| EPG Janitor | Repairs and strips EPG data; may tag channel names | No effect on subscriptions; we do not manage EPG |
| EPGeditARR | Virtual and filler EPG | Status line (installed/missing, loaded, trusted, update available); warnings if not installed/enabled/loaded and to keep its rename/sort actions away from Lineuparr-owned lineups |
| Lineuparr | Creates whole lineups (groups and channels) and enables them in profiles | Defines the catalogue; a full sync may remove channels; our reconciliation narrows group profiles again automatically |

The ownership split the product commits to: Lineuparr owns lineups, EPGeditARR owns virtual/filler EPG, ECM and Stream Mapparr own channel visibility inside their profiles, otpravkarr owns only user-to-profile assignment and the membership of its own group profiles.

### 7.4 Player projects

The portal recommends FredTV (Windows, Linux) and IINA (macOS) as primary players, with VLC and a generic Xtream-Codes player as legacy fallbacks. FredTV download buttons resolve the latest installer files (Windows installer, Debian-family package, Fedora-family package) from the FredTV project's public release listing, cached in memory for one hour, with concurrent lookups coalesced, a 10-second timeout, and failures cached too (so an outage never hammers the release host); when a file cannot be resolved the button links to the project's releases page. IINA is offered via a one-line install command for the macOS package manager plus a link to its site. Today every player receives the same playlist URL; the structure allows per-player URLs later.

## 8. User interface

### 8.1 Information architecture

| Area | Pages |
|---|---|
| Setup | First-run wizard (six steps); "not found" after completion |
| Admin | Login; Dashboard; Users; Settings; Plugins; Audit Log |
| Portal | Home (sign-in view, revoked view, self-managed view, or credentials and setup guide); Plex return/onboarding page; My channels; playlist snapshot download; an owner "where would you like to go?" page that exists but is not linked |

**Global gate**: before setup completes, every request except the wizard, the public health endpoint and static assets redirects to the wizard. Admin pages without an admin session redirect to login (and clear a bad cookie); subscriber-only pages without a subscriber session redirect to portal home; a signed-in admin opening portal home is sent to the dashboard.

**Admin shell**: a collapsible left sidebar (logo, "Admin console" label, navigation with the active item marked by an orange bar, footer with the admin's name and an icon-only sign-out), a top bar with a toggle, a keyboard shortcut to toggle, and the open state remembered for a week. Below tablet width the sidebar becomes a slide-in drawer that closes after navigation and has an explicit close button.

**Portal shell**: a sticky translucent header with the logo, a "My channels" link, the person's Plex avatar (initials fallback) and name, and an icon-only sign-out. Signed-out views have no header.

### 8.2 Shared interaction patterns

- **Toasts** for clipboard copies and most admin actions; success toasts fire *before* any page reload so a slow reload cannot swallow them. The toast layer never blocks clicks.
- **Confirm dialogs** with title, consequence text, "Cancel" and a red confirm button; dialogs trap focus.
- **Copyable fields**: label, read-only monospace value, reveal/hide for secrets (masked by default), copy button with a 2-second success check, a toast and a polite live-region announcement; failures say so.
- **QR code**: generated only on click, rendered in the browser on a white tile; failure suggests copying the URL instead.
- **Group picker**: search, "N selected · M available", select/clear all (or "filtered" while searching), checkbox rows with channel counts, empty and no-match states, a render cap (around 300 rows) with a "refine your search" hint, and a single-Tab-stop keyboard model (arrows, Home/End, Space/Enter).
- **One-time password dialog**: shown after a provisioning that returned a password; the value selects on click; copy result is shown inline; "it will not be shown again".

### 8.3 Pages

**Dashboard.** Three health tiles (Plex, Dispatcharr, local database) with status dot, badge and "checked … ago"; a Users card (total, active, inactive, orphaned — amber when above zero — and counts by mode, excluding the owner's duplicate mapping); a Sync Status card (running/idle, last run, duration, a help line listing the four reconcile steps, and "Run sync now" which reports completion, error counts, "already in progress", missing configuration, or after 30 seconds "still running in the background — refresh shortly"); a Health Check card; Recent Activity (latest ten audit entries with colour-coded action badges and a "View all" link); and Available Plex Friends (accepted friends not yet mapped, from the cache, with a note that they will be provisioned when they sign in). No live streaming or polling; data refreshes after a manual sync.

**Users.** Heading with count and a "Subscribe myself" button; link-based filters for status (all/active/inactive/orphaned) and mode (all/automatic/self-managed/staff) plus a username search (Plex or Dispatcharr name, case-insensitive) — all in the URL; an unpaginated table (avatar and Plex name, Dispatcharr name, mode badge, policy, status badge with an amber Drift badge and tooltip, last accessed, actions menu); empty state "No users found". If Dispatcharr is slow the page degrades after the interactive deadline to database rows without drift or group data. Row actions as in 6.10, plus a read-only View Details dialog with every stored field and timestamp.

**Settings.** Independent cards, each with its own Save, toast and inline confirmation; secret inputs clear after save while non-secret inputs keep their contents. Cards: Plex connection (URL, token status badge, "new token, leave blank to keep", read-only machine ID; saving re-verifies and distinguishes "saved" from "verified, no changes needed"); Dispatcharr connection (internal URL, optional external URL with explanation, key status badge, new key); Sync interval (1–1440 minutes; saving reschedules); Default provisioning (read-only, labelled as setup-only); Security / allowed origins (one per line; the configured server origin is noted as always allowed; a lockout guard refuses a list that would reject the admin's own current origin); Audit retention (positive whole days); Lineup policy (default policy radio with "core plus bundles" recommended, and three pickers for fixed, core and approved groups; disabled with an explanation when no live non-quarantine groups load; validated against live groups on save); Lineup bundle catalogue (version field, one card per bundle with editable display name, enabled flag and groups, and a create form with stable ID and slug rules, both immutable after creation). Configuration audit entries are written only when something actually changed.

**Plugins.** Read-only cards per detected plugin: name, enabled badge, version, a "Generic" badge for unrecognised plugins, description and advisories; distinct states for not configured, unreachable and none installed.

**Audit Log.** URL-backed filters: action (the full fixed list), actor-or-user text (debounced; literal matching, so underscores in usernames behave), per-page (10/25/50/100), after/before date pickers (whole local days). Table with expandable rows (formatted detail or "No additional details"), timestamp in monospace, actor ("system" when empty), colour-coded action badge, client address. Pagination with range text, previous/next, page-of-total, clamping of out-of-range pages, scroll-to-top with focus preserved, and filter changes resetting to page one while keeping scroll position.

**Portal home, signed in (automatic mode).** Eyebrow "YOUR STREAM", the person's name as a serif headline, an Active/Inactive badge. Tab **Credentials**: an explanatory card recommending the XC/URL setup and the native guide URL; the QR tile; masked fields for playlist URL, player-API URL and guide URL; "Download M3U snapshot"; "Refresh Credentials" with a consequence dialog; the snapshot caveat. Tab **Setup Guide**: recommended players with per-platform instructions and install buttons (the primary one glows), each card ending with its own masked playlist field; then legacy fallbacks.

**Portal home, other states.** Self-managed/staff: an optional one-time temporary password alert, an explanation that credentials live in Dispatcharr, the username and an "Open Dispatcharr" link. Automatic but unprovisioned, or no HTTPS public URL: a red "Provisioning Issue" alert with the specific reason. Revoked: the header with an Inactive badge, an "Access Revoked" alert and a sign-out button.

**My channels.** Heading and copy adapt to policy ("My channel bundles" with "Your core lineup is always included" versus "My channel groups" with "Changes apply right away"). States: locked/managed (read-only chips), nothing offered, approved-selection picker with a zero-selection warning, or bundle checkboxes with group counts and a note that core channels remain. Saving reloads with a "Saved" confirmation; errors name the cause (managed by admin, not fully provisioned, invalid selection, streaming service not configured).

**Plex return page.** Shows "Completing sign-in…" while provisioning, the onboarding group picker for eligible new friends (with eyebrow "WELCOME, {name}" and a zero-selection warning), or an error page with a specific message (no access, revoked, missing or expired sign-in session, Plex unreachable, could not set up account).

**Error page.** A centred card with the status, a plain description ("This page doesn't exist." for not-found, otherwise the error's message) and a "Go home" button. Unexpected server errors show only a generic message; details go to the log.

### 8.4 Accessibility, responsiveness, localisation

A skip link is the first focusable element in every shell; visible orange focus rings; labelled navigation and filter regions; every icon-only control has a label; dialogs trap focus; live regions announce copy results and save messages; invalid inputs are flagged and linked to help text; wizard steps are announced as completed/current; sidebar triggers expose expanded/controls state correctly on mobile; colour contrast tuned to WCAG AA; all motion respects reduced-motion. Tables hide secondary columns on narrow screens and hint at horizontal scroll with an edge fade; dialog button groups wrap at phone widths. British English only; no translation layer.

## 9. Configuration and operations

### 9.1 Deployment shape

A single self-hosted instance: one web process (serving admin console, portal and APIs) with an embedded background scheduler and a single-file embedded relational store on a persistent volume. Container packaging lives in a separate repository by design. Typical placement is behind the operator's reverse proxy, often sharing a private network (or VPN egress) with Dispatcharr. The production runbook from the live rollout also kept Dispatcharr's public ingress narrow: only credentialed Xtream-style playlist/API/guide paths and the credential-free logo cache were exposed; Dispatcharr's own admin, API and un-credentialed outputs were denied, and the credential-bearing direct live path stayed denied because Dispatcharr logged it. That is an operator concern outside the app, but it is the context the app was built for.

### 9.2 Process-level settings (operator)

| Setting | Meaning and rules |
|---|---|
| Master secret (required) | Source of all derived encryption keys. Must decode to at least 32 random bytes (hex or base64 recognised; otherwise raw text length) and show minimal entropy; weak or missing is fatal at startup with a hint on how to generate one. Must stay constant across restarts (see key rotation). |
| Database location | Defaults to a data directory that is created automatically. In production, an *explicitly configured* path that does not exist makes the app refuse to start rather than silently create an empty replacement (protects against a missing volume mount). |
| Listen host and port | Defaults bind all interfaces on a conventional port; a busy port fails fast at startup. |
| Public origin | The exact address people open in the browser. Required for plain HTTP; may be left unset only behind an HTTPS reverse proxy that passes the original host. Normalised (case, default port, trailing slash, international hostnames); a path, query, fragment or embedded credentials is a startup error that never echoes the value. Always allowed by the origin check, so changing it can never lock the admin out. Startup warns when neither it nor a trusted protocol header is configured. |
| Idle connection timeout | Seconds before an idle client connection closes (default 10; 0 disables). Interactive Dispatcharr calls are sized to finish inside it. Event-stream responses are exempt. |
| Shutdown drain timeout | Seconds to finish in-flight requests on a termination signal (default 30); the process exits at the deadline regardless. A hang-up signal behaves like termination once; a second termination signal exits immediately. |
| Request body limit | Default around half a megabyte, with unit suffixes or unlimited. |
| Client-address header and proxy depth | Only when every request passes through a trusted proxy: read the client address from the forwarded-for header, N hops from the right. Used for rate limiting. Without it the TCP peer is used. |
| Protocol and host headers | Only when the public origin is unset, behind a trusted proxy. |

When the public origin is configured, a small **front** listens on the public address and forwards to the application over a private local socket, stamping every request with the configured scheme and host (never trusting the client's host header, which defeats DNS-rebinding tricks) and with the real peer address in a header that clients cannot forge. The front binds before the app loads (so a busy port fails immediately), queues early requests, forwards bytes faithfully (no redirect following, no decompression, client aborts cancel upstream), pauses the idle timer while waiting on the app, returns a gateway error if the app is unreachable, and cleans up its socket directory on every exit path.

### 9.3 Admin-configurable settings (in the wizard and Settings)

Plex server URL, admin token, machine ID (read-only after validation); Dispatcharr internal URL, external URL, API key; allowed origins; sync interval; audit retention days; default provisioning mode and default group/profile (setup only; see 12); lineup policy default, fixed/core/approved group lists, bundle catalogue and version. Also stored but without a settings form: the global "allow users to choose their own groups" switch (default allowed) and the learned quarantine names.

### 9.4 Startup sequence

Validate the master secret → open (or refuse to create) the database → apply pending schema migrations in one all-or-nothing batch → restore learned quarantine names → build the sync job from the configured interval → run one health probe → register sync, health, session-cleanup and audit-rotation jobs and start the scheduler → print the bootstrap banner if setup is incomplete → record the start time for uptime. Today this runs lazily on the first request rather than at process start (see 12).

### 9.5 Persistence, backups, upgrades

All state is in the single database file plus the master secret; the two must be backed up and restored *together* (encrypted values are unreadable without the secret). The live rollout's practice was coherent snapshots of the database paired with the running image version, with "never downgrade code across a schema migration" as a hard rule; a schema migration is forward-only, applied automatically at startup, and tracked by version. A standalone **key-rotation tool** re-encrypts every encrypted setting and every stored streaming password from an old secret to a new one in a single transaction (refusing identical or weak new secrets); run it with the app stopped, then switch the secret and restart. Sealed cookies simply expire; sessions are unaffected.

### 9.6 Logging, health and privacy

Logs are single-line structured entries: one per request (timestamp, method, path without query string, status, duration, client address), plus scheduler job events, health events, unhandled-error entries (with request ID, error class, message and stack) and the bootstrap banner. Nothing user-facing ever includes upstream response bodies. Query strings and bodies are never logged, and the only secret deliberately printed is the bootstrap token at first run. The audit trail (in the database) is the operator's history of who did what.

Health is exposed as a public one-word status and an admin-only detailed status. There are no metrics, telemetry or outbound reporting of any kind; the only outbound calls are to Plex, Dispatcharr and the FredTV release listing. Subscribers' Plex tokens are never stored; their email and avatar are.

## 10. Security

- **Authentication**: a modern memory-hard, salted password hash for the admin password (minimum 12 characters); Plex web sign-in for everyone else; owner-as-admin by account-ID match against the stored admin token. Prior session deleted on every sign-in. Sessions: random opaque tokens, server-side records with sliding expiry (1 hour admin, 4 hours subscriber), type-checked on every guard. Sessions whose mapping has vanished are destroyed on sight; sessions whose mapping is inactive are kept alive only to render the revoked view.
- **Cookies**: HttpOnly, site-wide path, Secure whenever the public origin is HTTPS (deletions carry the same flag so browsers honour them), strict same-site for admins (with the single, test-guarded relaxation for the owner's Plex return hop), lax for subscribers and short-lived handshake cookies. Sealed cookies (onboarding identity, one-time password) are encrypted, carry their own expiry, and never contain the Plex token.
- **Cross-site request protection**: all state-changing requests must carry a browser origin that canonically matches the allowed list (configured public origin always included; saved origins additive); missing, null or malformed origins are rejected; internal APIs additionally reject requests the browser marks as cross-site and answer "unauthenticated" before "forbidden origin" so unauthenticated callers get a truthful status. Settings refuse an origin list that would lock out the current admin.
- **Secrets at rest**: authenticated encryption with a fresh nonce per value and per-purpose keys derived from the master secret (settings, subscriber streaming passwords, setup claim proof, sealed cookies each use their own purpose so ciphertext cannot be replayed across purposes). Admin password hashed, not encrypted.
- **Transport rules**: URLs that carry secrets (Plex server, Dispatcharr internal and external) must be HTTPS or loopback; only web schemes anywhere; the Dispatcharr key is only ever sent to the configured host even when the API returns links to other hosts.
- **Boundary hardening**: pages cannot be framed, content sniffing is disabled, a strict referrer policy and a restrictive permissions policy are set, and a strict content-security policy with no inline styles or scripts is enforced (images and connections allowed only to self and Plex's domains). Error responses never leak internals.
- **Rate limits** (in-memory, per client address): setup claim/recovery 5 per 15 minutes; admin login 5 per 5 minutes; Plex sign-in start 20 per 15 minutes.
- **Exposure invariants** (the product's real security boundary): never an empty profile list; subscribers never at admin level; nothing scoped without a live remote lookup; teardown on failed scoping; approved list fails closed; plugin integration read-only.
- **Trust assumptions**: the operator controls the host, the reverse proxy and Dispatcharr; Dispatcharr's own access control (profiles plus user level) is the stream-time boundary, and otpravkarr's playlist filtering is information hygiene, not enforcement; Plex's friends list is authoritative for entitlement.

## 11. Non-functional requirements

- **Scale**: one owner, tens (not thousands) of subscribers, a Dispatcharr catalogue of hundreds to a few thousand channels and up to around a thousand groups. Users and audit pages are designed for that: users are unpaginated; audit is paginated server-side.
- **Latency**: interactive pages must render a degraded state within the idle-socket window rather than hang; interactive upstream calls are bounded to a few seconds, background calls to about 15 seconds with limited retries.
- **Reliability**: all background work is isolated per step and per user; one failing component never stops the others; health flapping is damped; scheduler never bursts after stalls; sync is mutually exclusive with itself; every mutation to Dispatcharr is either confirmed or compensated and reported.
- **Idempotency**: provisioning, subscription enforcement and reconciliation are safe to repeat; credential rotation and sync are intentionally not (each run acts again) but are serialised or guarded.
- **Operational simplicity**: a single process, a single file store, graceful drain on shutdown, fail-fast on misconfiguration, and a first-run experience that requires nothing but reading one log line.

## 12. Known weaknesses and improvement ideas

Concrete problems observed in the source, with generic suggestions.

**Correctness and consistency**
- Creation-path teardown after a failed scoping writes no compensating "disabled" audit entry and leaves the encrypted password on the mapping, which then blocks "delete local mapping". Reactivation does both correctly; align them.
- If the local write fails after a successful remote create, the remote account is orphaned with no cleanup and no record of its ID. Consider a remote delete on that path or an outbox-style reconciliation.
- The sync-interval setting is read when the job is built at startup, but Settings reschedules live; keep one mechanism.
- The "profiles recreated" counter in subscription sync is never incremented. Remove or implement.
- Event-group detection runs on the full profile name, and names are truncated to Dispatcharr's limit, so a very long group name could lose its event suffix. Detect on the group, not the derived profile name.
- The setup "Defaults" step collects a default group and profile that nothing consumes; Settings even says provisioning defaults are not used at runtime. Either make them meaningful (for example as the fixed list seed) or drop the step.
- Staff-mode users are scoped at provisioning but skipped by subscription sync, so their access can drift. Decide whether staff is a real mode.

**Security hardening**
- Session tokens are stored unhashed; store a hash.
- Ciphertexts have no key-version tag and are not bound to their row; add versioning and associated data to make rotation incremental and swaps detectable.
- The bootstrap token is validated rather than consumed per claim, and is never regenerated without a restart; consider rotating it on expiry and consuming it on successful claim.
- Rate limits live in memory, count successful attempts, and reset on restart; persist them and exempt successes.
- No strict-transport header is set; the setup-gate redirect bypasses the security-header stage.
- The login path returns early for unknown usernames without a hash computation (minor timing signal).
- Secret validation and the missing-database guard run on the first request, not at process start; a misconfigured instance looks "up" until someone connects.

**Product gaps and inconsistencies**
- The owner "where would you like to go?" page exists but is unreachable; the owner is sent straight to the dashboard. Decide and delete or link.
- The server supports a global "users may choose their own groups" switch and a selectable-groups list, but Settings has no control for it.
- The Dispatcharr setup step claims it retries with backoff; it makes a single attempt. Fix the copy or the behaviour.
- The admin friends API and detailed health API have no UI consumer; the dashboard reads the friends cache directly.
- Only one admin account can exist and it cannot change its password or username after setup; add account management.
- The admin never sees a rotated password and there is no way to hand a subscriber their credentials out-of-band; consider an admin-visible one-time reveal.
- No notifications (to the owner on sync errors, or to subscribers on rotation).
- Audit ordering has no tie-breaker within a second; add a secondary sort on ID.
- The settings cache is effectively unused, so every read decrypts; either load it at startup or remove it.
- All in-memory state (sign-in handshakes, friends cache, rate limits, health, scheduler lock) assumes a single process; document or redesign for multiple workers.
- Dashboard has no live refresh; a lightweight event stream for sync and health status would make "Run sync now" feel less blind.
- One portal string hard-codes a Danish core lineup; make lineup wording configurable.

## 13. Glossary

| Term | Meaning |
|---|---|
| **Accepted friend** | A Plex user whom the server owner has shared with and who has accepted; the only entitlement that grants portal access. Pending invites do not count. |
| **Admin (administrator)** | The single local account that operates the console; also reachable by the Plex server owner signing in with Plex. |
| **Approved groups** | The instance-wide list of channel groups subscribers may ever receive; unset means none. |
| **Bootstrap token** | The one-time, 15-minute code printed to the log at first start, required to claim the setup wizard. |
| **Bundle** | A named, ordered set of channel groups with a permanent ID and slug that subscribers can opt into under the "core plus bundles" policy. |
| **Channel group** | A Dispatcharr grouping of channels; the unit of subscription. Distinct from Dispatcharr's account permission groups. |
| **Channel profile** | A Dispatcharr object that filters which channels a user sees; a user sees the union of their assigned profiles, and an empty list means all channels. |
| **Core groups** | Groups always included under the "core plus bundles" policy. |
| **Drift** | A mismatch between a subscriber's remote profile assignment and their stored effective groups, shown as a badge and fixed by re-saving or by sync. |
| **ECM (Event Channel Managarr)** | The Dispatcharr plugin that owns visibility of event channels; otpravkarr only reports whether its own event profiles are in ECM's scope. |
| **Effective groups** | The materialised set of groups a subscriber currently receives after policy resolution and filtering. |
| **Empty profile** | The otpravkarr-owned Dispatcharr profile with zero channels enabled, assigned to anyone with zero effective groups. |
| **Event group** | A group (and its profile) whose name ends in the PPV/Events or Unscheduled Events suffix; membership is reconciled with ECM-hidden channels preserved. |
| **Fixed policy** | Everyone gets the same admin-defined list; no user choice. |
| **Group profile** | The otpravkarr-owned Dispatcharr profile containing exactly one channel group's channels, named with the owned prefix. |
| **Intent** | What a user or admin chose (policy override, bundles, approved picks), kept separately from effect and never widened automatically. |
| **Known-channel snapshot** | The channel set last seen for a group profile; used to distinguish ECM-hidden channels from new arrivals. |
| **Lineup policy** | The rule that turns intent into requested groups: fixed, core plus bundles, or approved selection. |
| **Mapping** | The local record linking one Plex account to one Dispatcharr account with its rules and state. |
| **Orphaned** | An active mapping whose Dispatcharr account no longer exists. |
| **Owner / self-subscription** | The Plex server owner; their optional separate non-admin subscriber account, excluded from friend-sync reaping. |
| **Provisioning mode** | Automatic (otpravkarr owns credentials), self-managed, or staff. |
| **Public origin** | The exact browser-facing address of the instance; always allowed by the origin check. |
| **Quarantine groups** | Groups the IPTV Checker plugin uses for dead/slow/black-screen channels; never offered or granted. |
| **Reconcile / sync** | The four-step background job: friend sync, quarantine refresh, subscription sync, ECM scope check. |
| **Setup claim** | The 10-minute, cookie-bound ownership of the setup wizard held by one browser at a time. |
| **Streaming (XC) password** | The Xtream-Codes credential Dispatcharr checks on playlist and stream requests, distinct from the account's own login password; otpravkarr keeps both identical and rotates them together. |
| **Subscriber** | A provisioned portal user. |
| **Subscription** | The set of channel groups a subscriber may see, enforced as one group profile per group. |
