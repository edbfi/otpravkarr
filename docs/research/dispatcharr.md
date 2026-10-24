# Dispatcharr research for the rewrite

Temporary research input (plan step G5). Delete it once its outcomes are in `docs/SPEC*.md` and `docs/decisions.md`.

**Sources read on 2026-10-18.** Line links point to Dispatcharr tag `v0.32.0` ([`c52bf87`](https://github.com/Dispatcharr/Dispatcharr/tree/c52bf87acb7ff2d787d6dcfb9fe3d39999585912), released 2026-10-07; it is the latest release) unless marked **dev**. **dev** means the unreleased `dev` branch at [`f451f33`](https://github.com/Dispatcharr/Dispatcharr/tree/f451f334bec9d3f78a6e56d3c3ec8da436df343b) (2026-10-16). Also read:

- the docs repo, [Dispatcharr-Docs `192061c`](https://github.com/Dispatcharr/Dispatcharr-Docs/tree/192061c43443365771425d114484608cc3d01f51);
- the plugin repos at the SHAs listed in §6;
- the legacy client (`origin/legacy-old/v1:src/lib/dispatcharr/**`).

"Spec" means the local product spec `otpravkarr.md`. It isn't in this repo.

## Summary

- **The empty-profile rule still holds, on v0.32.0 and on dev.** A non-admin user with zero channel profiles sees every channel at or below their `user_level`, on every output and at stream time. Admins (`user_level >= 10`) bypass profiles entirely. The spec's "never an empty profile list" invariant stays mandatory.
- **The biggest widening writer is Dispatcharr core, not the plugins.**
  - On every M3U refresh, Auto Channel Sync re-enables each auto-synced channel in *every* profile. That includes otpravkarr's group profiles and the empty profile, unless the operator scopes each auto-sync group to explicit profiles or to "No Profiles" (v0.30.0+).
  - Channels created through the REST API or UI join every profile by default.
  - New profiles start with every channel unless `start_empty: true` is sent (v0.30.0+).
- **"Highest non-admin level" (Standard, 1) is the wrong level for subscribers.**
  - A Standard user can log in to the Dispatcharr web UI and REST API. There they can browse channels beyond their profiles, read provider stream URLs (fixed on dev, not released), read every plugin's settings, and view DVR recordings by default.
  - Streamer (0) is the XC-only level. Channels default to level 0, so Streamer loses nothing on XC.
- **VOD is not scoped by channel profiles.** Movies and series default to *on* for every user (`vod_movies_enabled` / `vod_series_enabled`), so every subscriber with XC credentials gets the whole VOD library today. The spec doesn't mention this.
- **Per-user XC credentials are still the only per-user, revocable delivery surface.**
  - `/output/m3u/<profile>`, `/output/epg/<profile>` and `/hdhr/<profile>/…` take no credentials. They are gated only by network allowlists.
  - Their stream URLs (`/proxy/ts/stream/<uuid>`) are also unauthenticated.
- **The API is unversioned, and it changes often.**
  - There is no `/api/v1`, the OpenAPI `VERSION` is a constant `1.0.0`, and the project is still 0.x.
  - A minor release lands every 2–5 weeks and routinely changes behaviour that otpravkarr depends on.
  - The best compatibility hook is `GET /api/core/version/`, which needs no authentication.
- **API keys are per user, unscoped, stored in plaintext, and inherit the user's level.** Every admin `GET /api/accounts/users/` response includes *every* user's `api_key`.
- **Plugins:** most of the spec's §7.3 rows need corrections (§6). No plugin creates profiles, touches users, or writes to all profiles. ECM, Lineuparr and Stream Mapparr only write to profiles named in their own settings.

## 1. User model, levels, profiles, custom properties

**Levels.** `User.UserLevel` has three values: `STREAMER = 0`, `STANDARD = 1` and `ADMIN = 10`. The default is Streamer ([`apps/accounts/models.py#L19-L33`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/models.py#L19-L33)). `user_level` is a plain `IntegerField` with no choices validation in the serializer, so any integer can be written. Authorisation uses `user_level` comparisons only; Django `auth.Group`s are unused and admin-only ([`apps/accounts/api_views.py#L438-L449`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/api_views.py#L438-L449)).

| Level | Web UI | REST API | XC / M3U / EPG output | Source |
|---|---|---|---|---|
| Admin (≥10) | full | full (`IsAdmin`) | everything, profiles ignored | [`permissions.py#L23-L29`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/permissions.py#L23-L29), [`output/views.py#L213-L214`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/output/views.py#L213-L214) |
| Standard (1) | yes: Channels, TV Guide, Settings; DVR (view by default), VODs | every `GET` guarded by `IsStandardUser`. That covers channel/stream lists, channel groups, plugins list *with settings*, EPG grid. | filtered by profiles + level | [`permissions.py#L15-L20`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/permissions.py#L15-L20), [`#L64-L79`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/permissions.py#L64-L79) |
| Streamer (0) | refused by the frontend | only `Authenticated` endpoints (`users/me`, own `api-keys`, own profiles) | filtered by profiles + level | [`frontend/src/store/auth.jsx#L122-L124`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/frontend/src/store/auth.jsx#L122-L124), [docs `system.md#L1-L20`](https://github.com/Dispatcharr/Dispatcharr-Docs/blob/192061c43443365771425d114484608cc3d01f51/docs/en/system.md) |

**What a Standard user can reach beyond their profiles.** This all depends on them having a login password.

- **Channel list.** `/api/channels/channels/` filters by the user's profiles only when no `channel_profile_id` is passed. A Standard user can pass any profile ID, or `show_disabled`, and see other channels ([`apps/channels/api_views.py#L1191-L1253`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/api_views.py#L1191-L1253)). The docs agree: "Dispatcharr UI access is granted for all channels … Restrictions apply only for access via XC" ([docs `system.md`](https://github.com/Dispatcharr/Dispatcharr-Docs/blob/192061c43443365771425d114484608cc3d01f51/docs/en/system.md)).
- **Stream list.** `/api/channels/streams/` is listable by Standard users and returns provider `url`s, which contain provider credentials ([`apps/channels/api_views.py#L186-L203`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/api_views.py#L186-L203)). It is fixed on dev by [`f451f33` "restrict provider URLs to admin users only"](https://github.com/Dispatcharr/Dispatcharr/commit/f451f334bec9d3f78a6e56d3c3ec8da436df343b), which is unreleased.
- **Plugins.** `GET /api/plugins/plugins/` is `IsStandardUser` and returns raw plugin settings, including password-type fields (§6).
- **DVR.** For Standard users, `dvr_access` defaults to `view` ([`apps/channels/dvr_access.py#L24-L44`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/dvr_access.py#L24-L44)).

The legacy client set `user_level: 1` and used the XC password as the Django login password too (legacy `src/lib/bridge/subscriptions.ts`, `provisioner.ts`). So every legacy subscriber could log in to Dispatcharr's UI.

**Channel profiles.**

- **Model.** `ChannelProfile` has only `name`, which is unique with `max_length=100`. Membership lives in `ChannelProfileMembership(channel_profile, channel, enabled)`. A missing row means "not in the profile" ([`apps/channels/models.py#L1229-L1240`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/models.py#L1229-L1240)). "All" is a UI sentinel (`0`), not a row.
- **Assignment.** `User.channel_profiles` is a many-to-many field. Outputs use the union of the user's profiles' enabled memberships (§5). Deleting a profile cascades away users' assignments, so a user whose only profile is deleted ends up with an **empty list, which means everything**.
- **Channel-side filters, applied to everyone below admin:**
  - `Channel.user_level`: the channel is visible when `channel.user_level <= user.user_level`. The default is 0 ([`models.py#L484`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/models.py#L484)).
  - `is_adult`, together with the per-user `hide_adult_content`.
  - `hidden_from_output`, a global hide for every output and every user ([`models.py#L528-L532`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/models.py#L528-L532), [`output/views.py#L231-L237`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/output/views.py#L231-L237)).
- **New profiles.** A new profile is back-filled with every channel enabled by a `post_save` signal, unless created with `start_empty: true` (added in v0.30.0, [#1525](https://github.com/Dispatcharr/Dispatcharr/commit/30527e1f60a91a0bb2565e8248a5134176d09322); [`signals.py#L236-L243`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/signals.py#L236-L243), [`serializers.py#L290-L303`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/serializers.py#L290-L303)).
- **New channels.**
  - A channel created via `POST /api/channels/channels/` *without* `channel_profile_ids` is added, enabled, to **all** profiles; `[]` means none ([`api_views.py#L1035-L1100`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/api_views.py#L1035-L1100)).
  - Channels created through the ORM (plugins) get no membership rows.
- **Auto Channel Sync.** This runs on every M3U refresh for groups with auto-sync on.
  - It assigns new auto-created channels to the group's `channel_profile_ids`, or to **`ChannelProfile.objects.all()` when that is blank**.
  - It then *reconciles* existing auto-created channels: enabled in the target profiles, disabled elsewhere ([`apps/m3u/tasks.py#L2635-L2656`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/m3u/tasks.py#L2635-L2656), [`#L3014-L3027`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/m3u/tasks.py#L3014-L3027), [`#L3069-L3126`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/m3u/tasks.py#L3069-L3126)).
  - With the default (blank) setting, every refresh re-enables those channels in every otpravkarr profile, including the empty profile. That exposure lasts until otpravkarr's next reconcile.
  - The v0.30.0 "No Profiles" option (`skip_channel_profile_memberships`) turns this off per group. Group settings are readable through `GET /api/m3u/accounts/` (`channel_groups[].custom_properties`, [`apps/m3u/serializers.py#L138`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/m3u/serializers.py#L138)).
  - The scope is only channels with `auto_created=True` from that account and group ([`#L2405-L2425`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/m3u/tasks.py#L2405-L2425)).

**User fields over REST.** `UserSerializer` exposes:

- `id`, `username`, **`api_key`** (read-only), `email`, `user_level`;
- `password` (write-only), `channel_profiles`, `custom_properties`, `avatar_config`, `stream_limit`;
- `is_staff`, `is_superuser`, `last_login`, `date_joined`, `first_name`, `last_name`.

`is_active` is **not** exposed, so a user can't be deactivated over the API ([`apps/accounts/serializers.py#L51-L77`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/serializers.py#L51-L77)). Validation rules:

- Usernames and the XC password must match `^[A-Za-z0-9._@-]+$` (v0.29.0+; [`#L16`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/serializers.py#L16), [`#L79-L115`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/serializers.py#L79-L115)).
- `password` is effectively required on create, because `set_password(validated_data["password"])` is called ([`#L131-L140`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/serializers.py#L131-L140)).
- `PATCH` **merges** `custom_properties`, and a `null` value deletes a key ([`#L142-L177`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/serializers.py#L142-L177)). The legacy client's "always merge" is still correct, and is now done server-side as well.
- `custom_properties` is capped at 100 KB.

**Custom properties that Dispatcharr reads.** The admin-only ones can't be set by the user via `PATCH users/me` ([`api_views.py#L413-L428`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/api_views.py#L413-L428)).

| Key | Meaning | Default when absent |
|---|---|---|
| `xc_password` | The only XC credential. Absent or empty means XC login is refused. | none: no XC |
| `allowed_networks` | `{UI, XC_API, M3U_EPG, STREAMS: "cidr,…"}`. A per-user allowlist that can only narrow the global one ([`dispatcharr/utils.py#L231-L273`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/dispatcharr/utils.py#L231-L273)) | inherit global |
| `vod_movies_enabled`, `vod_series_enabled` | XC VOD access ([`apps/vod/utils.py#L7-L33`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/vod/utils.py#L7-L33)) | **on** |
| `catchup_enabled` | Timeshift/catch-up ([`apps/channels/utils.py#L118-L133`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/utils.py#L118-L133)) | on, if the system setting is on |
| `dvr_access` | `none`/`view`/`manage`; Streamers are always `none` | `view` for Standard |
| `allowed_m3u_profile_ids` | Provider profiles allowed for Redirect stream profiles (v0.31.0) | all |
| `hide_adult_content` | Hides `is_adult` channels and VOD | off |
| `output_profile`, output-format override | Per-user transcode/format | system default |

`stream_limit` is a column, not a custom property; `0` means unlimited ([`apps/proxy/utils.py#L316-L345`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/proxy/utils.py#L316-L345)). Arbitrary extra keys are kept, so otpravkarr can store its own marker there.

**dev (unreleased):** a per-user, keyed app-data API (`/api/accounts/users/{id}/app-data/<key>/`, [`a8af8ff`](https://github.com/Dispatcharr/Dispatcharr/commit/a8af8ff12de8b9799636a0d50c8fcfc34dcc83fb)) for third-party apps. It is a cleaner home for an ownership marker than `custom_properties` once it ships.

## 2. Delivery formats

| Surface | Path | Auth | Scoping | Network rule |
|---|---|---|---|---|
| XC playlist | `/get.php?username&password[&type=m3u_plus]` | `xc_password` in the query string | user (profiles + level + adult) | `XC_API` |
| XC API | `/player_api.php`, `/panel_api.php` | same | user; VOD by the VOD flags only | `XC_API` |
| XC guide | `/xmltv.php?username&password` | same | user | `XC_API` |
| XC live stream | `/live/<u>/<p>/<id>[.ts\|.mp4]` and `/<u>/<p>/<id>` | path credentials | user, checked at stream time | `STREAMS` (dev: `XC_API`) |
| XC VOD / timeshift | `/movie/…`, `/series/…`, `/timeshift/…`, `/streaming/timeshift.php` | path/query credentials | VOD flags; timeshift is profile-scoped | `STREAMS`/`XC_API` |
| Plain M3U | `/output/m3u[/<profile_name>]` | **none** | the named profile, or **everything** if no name | `M3U_EPG` (local networks by default) |
| Plain XMLTV | `/output/epg[/<profile_name>]` | **none** | same | `M3U_EPG` |
| HDHomeRun | `/hdhr[/<profile>]/{discover,lineup}.json`, also `/api/hdhr/…` | **none** | profile | `M3U_EPG` |
| Proxy stream | `/proxy/ts/stream/<channel_uuid>` | **none** (`AllowAny`) | none (anyone who knows the UUID) | `STREAMS` (all addresses by default) |

Sources:

- Routes: [`dispatcharr/urls.py#L28-L66`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/dispatcharr/urls.py#L28-L66), [`apps/output/urls.py`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/output/urls.py).
- XC auth: [`output/views.py#L489-L509`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/output/views.py#L489-L509).
- M3U: [`#L160-L227`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/output/views.py#L160-L227).
- XC endpoints: [`#L581-L694`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/output/views.py#L581-L694).
- `stream_xc`: [`live_proxy/views.py#L990-L1043`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/proxy/live_proxy/views.py#L990-L1043).
- `stream_ts`: [`#L427-L435`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/proxy/live_proxy/views.py#L427-L435).
- Default CIDRs: [`dispatcharr/utils.py#L16-L24`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/dispatcharr/utils.py#L16-L24), [`#L231-L245`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/dispatcharr/utils.py#L231-L245).
- The upstream docs make the same recommendation as this section: share `get.php`/`xmltv.php`, keep `/output/*` private, and note that `/output/m3u` stream URLs need `/proxy/` ([docs `reverse-proxies.md#L245-L250`](https://github.com/Dispatcharr/Dispatcharr-Docs/blob/192061c43443365771425d114484608cc3d01f51/docs/en/reverse-proxies.md)).

**Properties of the XC surface relevant to otpravkarr.**

- **There is one credential per user, and it never expires.** The XC `user_info.exp_date` is always "now + 90 days" and `status` is always "Active". Nothing is tracked server-side ([`output/views.py#L555-L567`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/output/views.py#L555-L567)). Revoking access means changing or removing `xc_password`, or deleting the user.
- **The password travels in URLs.** It is in query strings and paths, so proxies and players will log it. `player_api.php` also echoes it back in the response.
- **What the auth check skips in v0.32.0.** XC auth does not check `is_active`. It compares passwords with plain `!=`, and it answers 404 for an unknown username versus 401 for a bad password. Dev centralises XC auth in [`apps/accounts/xc_auth.py`](https://github.com/Dispatcharr/Dispatcharr/blob/f451f334bec9d3f78a6e56d3c3ec8da436df343b/apps/accounts/xc_auth.py) with a constant-time compare, uniform 401s and a per-IP failed-auth rate limit. It still doesn't check `is_active`.
- **Stream-time enforcement exists.** `/live/…` re-applies profiles and level before streaming, so a stale playlist can't reach a channel that was removed. It does *not* re-check `hidden_from_output` ([`live_proxy/views.py#L1008-L1031`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/proxy/live_proxy/views.py#L1008-L1031)).
- **`stream_limit` is enforced per user** and reported as XC `max_connections`. It is the only built-in brake on credential sharing.
- **The XC guide is user-scoped.** It is the union of the user's profiles, not "profile-scoped". `get.php` points its `url-tvg` at `xmltv.php` with the same credentials ([`output/views.py#L286-L289`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/output/views.py#L286-L289)).
- **No signed or tokenised per-user URL mechanism exists for M3U/XMLTV.** The nearest thing is the v0.28.0 REST catch-up session API, which mints `session_id` playback URLs for native apps with a JWT or API key. That is for apps, not playlists. **Unverified** whether it covers live channels. From the changelog it appears to be catch-up only.
- **dev:** XC stream URLs move from the `STREAMS` to the `XC_API` network rule (CHANGELOG, Unreleased → Changed). This matters for the operator's ingress rules.

## 3. API authentication

- **Two schemes** ([`dispatcharr/settings.py#L355-L373`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/dispatcharr/settings.py#L355-L373)): SimpleJWT and `ApiKeyAuthentication`. The default permission is `IsAdmin`, since v0.23.0.
- **JWT.** `POST /api/accounts/token/` with username and password. The access token lives 30 minutes and the refresh token 1 day ([`settings.py#L541-L546`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/dispatcharr/settings.py#L541-L546)). Login is throttled to 3 per minute per IP.
- **How API keys work** ([`apps/accounts/authentication.py#L46-L88`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/authentication.py#L46-L88), [`api_views.py#L476-L525`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/api_views.py#L476-L525)):
  - **Header.** Send `X-API-Key: <key>` or `Authorization: ApiKey <key>`.
  - **Scope and lifetime.** One key per user, stored **in plaintext** in `User.api_key`, with no scopes and no expiry. It authenticates *as that user* with that user's `user_level`, and is refused if the user is inactive.
  - **Generate and revoke.** `POST /api/accounts/api-keys/generate/` creates a 40-byte URL-safe key and replaces any previous one; an admin can pass `user_id` to do this for another user. `POST /api/accounts/api-keys/revoke/` removes it.
  - **Exposure.** The key appears in `GET /api/accounts/api-keys/` (own key) and in the `api_key` field of every user object in `/api/accounts/users/`.
  - **Rate limit (dev).** Failed API-key attempts are rate-limited per client IP ([`80b817b`](https://github.com/Dispatcharr/Dispatcharr/commit/80b817b8c60e5325027cf87bdc9fcbaef041f4fe)).
- **Network gating.** Every authenticated REST call also passes `network_access_allowed(request, "UI", user)`. So the global "UI" CIDR list and the key owner's `allowed_networks.UI` both apply ([`permissions.py#L6-L12`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/permissions.py#L6-L12)). This lets an operator pin otpravkarr's service key to otpravkarr's own address.
- **Reverse-proxy header login (v0.32.0)** swaps a trusted proxy header for a JWT. It is for UI sign-in only and is irrelevant to subscribers.

**What spec §7.2 needs, and the permission each operation requires** (all at v0.32.0):

| Operation | Endpoint | Permission |
|---|---|---|
| List users / "exact-username lookup" | `GET /api/accounts/users/`. Flat array, unpaginated; **there is no username filter**, so the whole list (with every `api_key`) comes back and is matched client-side. | Admin ([`api_views.py#L364-L375`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/accounts/api_views.py#L364-L375)) |
| Get / create / update / delete user | `GET/POST/PATCH/DELETE /api/accounts/users/{id}/` | Admin |
| List channel groups | `GET /api/channels/groups/` (flat; `id, name, channel_count, m3u_account_count, m3u_accounts`) | Standard |
| List channels | `GET /api/channels/channels/?page_size=N`. It paginates only when `page` or `page_size` is present; the maximum `page_size` is 10000. It includes `effective_channel_group_id`. ([`api_views.py#L879-L890`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/api_views.py#L879-L890), [`serializers.py#L458-L524`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/serializers.py#L458-L524)) | Standard |
| List / get profiles (with enabled channel IDs) | `GET /api/channels/profiles/[{id}/]`. Admins see every profile, others only their own ([`api_views.py#L3137-L3160`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/api_views.py#L3137-L3160)). | Standard |
| Create profile | `POST /api/channels/profiles/ {name, start_empty}` | Admin |
| Bulk membership | `PATCH /api/channels/profiles/{id}/channels/bulk-update/ {channels:[{channel_id, enabled}]}`. It upserts, rejects unknown channel IDs with 400, and runs in one transaction ([`api_views.py#L3356-L3431`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/api_views.py#L3356-L3431)). | Admin |
| Plugins + settings | `GET /api/plugins/plugins/` → `{plugins:[…]}` | Standard |
| Health / version probe | `GET /api/core/version/` → `{version, timestamp}` ([`core/api_views.py#L442-L457`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/core/api_views.py#L442-L457)) | **none** (`AllowAny`) |
| M3U group auto-sync settings (new need, §1) | `GET /api/m3u/accounts/` | Admin |

The writes need Admin, so otpravkarr's key must belong to an admin-level user. There is no narrower option.

The legacy health probe, `GET /api/accounts/users/?page=1&page_size=1`, ignores both parameters and returns every user. It is expensive, and it puts every API key on the wire on each probe.

## 4. API stability

- **No versioning.** Routes have no version prefix. The OpenAPI `VERSION` is a constant `"1.0.0"` ([`settings.py#L375-L380`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/dispatcharr/settings.py#L375-L380)).
- **Schema.** drf-spectacular serves it at `/api/schema/` and `/api/swagger.json`, with Swagger UI at `/api/swagger/` ([`apps/api/urls.py#L27-L31`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/api/urls.py#L27-L31)). No `SERVE_PERMISSIONS` is set, so drf-spectacular's default `AllowAny` applies ([drf-spectacular settings](https://drf-spectacular.readthedocs.io/en/latest/settings.html)). **Unverified at runtime.**
- **Schema quality.** It is auto-generated and only partly accurate. Plugin endpoints are untyped (the legacy client noted "No response body"), and the VOD schema/runtime mismatches were only fixed in v0.31.0. It is useful for spotting drift in CI, not as a contract.
- **Semver.** The project is still 0.x ("adheres to Semantic Versioning", CHANGELOG), so any minor release may break things. The changelog has no "Breaking" section; behaviour changes are listed under Changed/Fixed.
- **Cadence** ([releases](https://github.com/Dispatcharr/Dispatcharr/releases)):
  - Recent releases: v0.27.0 2026-06-16, v0.28.0 07-19, v0.29.0 08-09, v0.30.0 08-29, v0.31.0 09-13, v0.32.0 10-07.
  - That is a minor every 2–5 weeks, with patches in between.
  - `main` carries releases and `dev` is the integration branch. dev is 95 commits ahead of v0.32.0.
- **Changes in the last six minors that touched otpravkarr's surface** (from [`CHANGELOG.md`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/CHANGELOG.md)):
  - **v0.23.0:**
    - Default permission became `IsAdmin`.
    - `users/me` stopped letting users set `xc_password`.
    - Login throttling arrived.
  - **v0.25.0:** per-user `allowed_networks`.
  - **v0.28.0:**
    - Channel list paginates when only `page_size` is given.
    - Catch-up flags arrived.
    - A permissions sweep; `/api/accounts/groups/` became admin-only.
  - **v0.29.0:**
    - Username and XC-password character set widened.
    - Profile-membership `PATCH` enforces ownership.
    - First-run setup limited to local networks.
  - **v0.30.0:**
    - `start_empty`.
    - Auto-sync "No Profiles".
    - VOD and DVR per-user flags.
  - **v0.31.0:**
    - `allowed_m3u_profile_ids`.
    - EPG grid scoped to the caller's channels.
  - **v0.32.0:** reverse-proxy auth.
  - **dev:**
    - XC auth refactor with rate limits.
    - API-key failure rate limit.
    - Provider URLs hidden from Standard users.
    - The app-data API.
- **What the rewrite should pin and check:**
  - Read `GET /api/core/version/` at startup and in the health probe, and compare it with the latest stable release (D30). `start_empty` and "No Profiles" exist from v0.30.0.
  - Warn rather than fail when Dispatcharr runs any version other than the latest stable release (D30).
  - Validate responses with strict schemas, failing closed on the fields enforcement depends on and staying lenient elsewhere.
  - Run a contract suite in CI against the latest stable Dispatcharr image (D30) that exercises every operation in the §3 table. Diff `/api/schema/` against a committed snapshot to flag drift.

## 5. The empty-profile rule

**Verified.** For a user with `user_level < 10`, every output path counts the user's profiles.

- **Zero profiles** gives no profile filter at all: `Channel.objects.filter(user_level__lte=user.user_level)`, plus the adult filter.
- **One or more profiles** requires an enabled membership in one of them.

| Path | v0.32.0 location |
|---|---|
| XC `get.php` / plain M3U with user | [`apps/output/views.py#L190-L214`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/output/views.py#L190-L214) |
| XC live categories | [`apps/output/views.py#L710-L735`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/output/views.py#L710-L735) |
| XC live streams | [`apps/output/views.py#L749-L790`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/output/views.py#L749-L790) |
| XC short EPG / data table | [`apps/output/views.py#L937-L963`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/output/views.py#L937-L963) |
| XMLTV (`xmltv.php`, `/output/epg`) | [`apps/output/epg.py#L87-L110`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/output/epg.py#L87-L110) |
| Live stream `/live/…` | [`apps/proxy/live_proxy/views.py#L1008-L1031`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/proxy/live_proxy/views.py#L1008-L1031) |
| Timeshift | [`apps/timeshift/views.py#L776-L790`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/timeshift/views.py#L776-L790) |
| REST channel list | [`apps/channels/api_views.py#L1233-L1253`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/channels/api_views.py#L1233-L1253) |

**Still true on dev.** Dev consolidates the rule into `channels_queryset_for_user` with the comment "No assigned profiles → unrestricted within level/adult" ([dev `apps/channels/access.py#L19-L62`](https://github.com/Dispatcharr/Dispatcharr/blob/f451f334bec9d3f78a6e56d3c3ec8da436df343b/apps/channels/access.py#L19-L62)). The code comment reads "If user has ALL profiles or NO profiles, give unrestricted access", but only the zero-count branch is implemented. Holding every profile doesn't bypass membership.

**Ways a managed user can end up with an empty list without otpravkarr writing one:**

1. Someone deletes, in the Dispatcharr UI, the profile that was the user's only assignment. The many-to-many rows cascade away.
2. A user is created without `channel_profiles` (the default). This affects otpravkarr's own creation window; the legacy client closed it by scoping right after the create.
3. Someone edits the user in the Dispatcharr UI and clears its profiles.

There is no "deny all" flag on users. The only hard fail-closed levers are:

- removing `xc_password`, which stops every XC path;
- a `user_level` below every channel's level, which gives no channels. Channels default to 0, so this would need a negative level. That is untested and **not recommended**.

## 6. The named plugins

All seven are listed in the official registry [Dispatcharr/Plugins](https://github.com/Dispatcharr/Plugins) (`main` `1025b6f`) as external entries pointing at the authors' repos.

**Keys.** UI and hub installs normalise keys to lowercase with `_` ([`apps/plugins/api_views.py#L78-L83`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/plugins/api_views.py#L78-L83)). A plugin folder copied in by hand keeps its dashes ([`loader.py#L146`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/plugins/loader.py#L146)), so match both forms.

| Plugin (key) | Repo @ tag (SHA) | What it actually writes | Profile writes | Verdict on spec §7.3 row |
|---|---|---|---|---|
| Event Channel Managarr (`event_channel_managarr`) | [PiratesIRC/…Event-Channel-Managarr-Plugin](https://github.com/PiratesIRC/Dispatcharr-Event-Channel-Managarr-Plugin/tree/11990f3a117bcfa3a3bda47b496da09ae782ca2d) v1.26.2832019 (`11990f3`) | Membership `enabled` on/off, plus EPG: it clears `epg_data` on hidden channels by default, can delete ProgramData, and can create a dummy EPG source. | Only profiles named in `channel_profile_name` (CSV, case-insensitive). Empty is an error, not "all". It **re-enables** channels no hide rule matches, and **flattens** visibility across all listed profiles (visible in any → written to all). | Mostly right. Add: the schedule (`scheduled_times`) and the m3u trigger (`auto_rescan_on_m3u_refresh`) are both **opt-in** (default off); it writes EPG; scope covers every group in those profiles unless `channel_groups` narrows it. Scheduled runs read `/data/event_channel_managarr_settings.json`, not `PluginConfig`, so REST-visible settings can differ from what scheduled runs use. The " — PPV/Events" / " — Unscheduled Events" suffixes appear nowhere in ECM or core; they are this deployment's naming (**unverified** origin). |
| IPTV Checker (`iptv_checker`) | [PiratesIRC/…IPTV-Checker-Plugin](https://github.com/PiratesIRC/Dispatcharr-IPTV-Checker-Plugin/tree/1e895f3d6d9daac49d5f3c0c4797ddce0a38392b) v1.26.2901902 (`1e895f3`) | Renames channels ("[DEAD]", "[Blank]", "[Slow]"); creates destination groups and moves channels into them; restore moves them back; **permanently deletes dead channels** (gated by `auto_delete_confirmation == "DELETE"`; "dead" includes black-screen); clears stream stats. | None (reads only) | Group names and defaults confirmed (`move_to_group_name`, `move_black_screen_group`, `move_low_framerate_group`). **Wrong:** the completion webhook was removed (2026-08-05); it now calls Stream Mapparr in-process. Add: it renames, deletes and restores channels. |
| Stream Mapparr (`stream_mapparr`) | [PiratesIRC/Stream-Mapparr](https://github.com/PiratesIRC/Stream-Mapparr/tree/023d686d77150e616251ab081a6b44cc020e419b) 1.26.2911353 (`023d686`) | Replaces ChannelStream rows (with `overwrite_streams`, which defaults to on). | Only the **first** profile in `profile_name`, and only through the **manual** `manage_channel_visibility` action. It disables in-scope channels, then enables one per group, and only among channels already enabled, so it can **narrow but never widen**. | Stream matching is right. **Wrong:** "refuses the 'All' profile" isn't in the code; it only checks that the name exists. The webhook was removed (2026-08-01). `manage_channel_visibility` is an action, not a setting, and `visible_channel_limit` caps streams, not visibility. |
| Channel Mapparr (`channel_mapparr`; repo spelled "Maparr") | [PiratesIRC/…Channel-Maparr-Plugin](https://github.com/PiratesIRC/Dispatcharr-Channel-Maparr-Plugin/tree/596caa5495b43d5fe230cddd9c5047ac5b962b35) 1.26.2911354 (`596caa5`) | Renames channels; creates groups and moves channels between them; **creates channels** from existing streams ("Import M3U") and stream-less seed channels, with **no membership rows**; sets logos. | None | Essentially right. "Imports M3U" means it creates channels from streams already in Dispatcharr. Add: it creates channels and sets logos. |
| EPG Janitor (`epg_janitor`) | [PiratesIRC/…EPG-Janitor-Plugin](https://github.com/PiratesIRC/Dispatcharr-EPG-Janitor-Plugin/tree/bdf55bf23601aa8ee48a08499691842004ca2e4c) 1.26.2901817 (`bdf55bf`) | Sets and clears `Channel.epg_data`; `remove_epg_from_hidden` **deletes ProgramData of shared EPG entries** (affecting other channels on the same entry); the manual `add_bad_epg_suffix` renames. | None. It reads `channel_profile_name` to decide what counts as "hidden". | Confirmed. Add: deleting ProgramData has side effects on other channels that share the EPG entry. Its watchdog reads the key `epg-janitor`, which may not match a hub install's `epg_janitor` (**unverified** at runtime). |
| EPGeditARR → **EPG & Sports Editor** (`epg_and_sports_editor`, legacy `epgeditarr`) | [jstevenscl/epg-and-sports-editor](https://github.com/jstevenscl/epg-and-sports-editor/tree/1a644c59f1b90409566d8bb30c03067b770a78d5) v0.5.08 (`1a644c5`) | Virtual/fill/sports EPG sources, EPGData and ProgramData; sets `Channel.epg_data`; renames only auto-created channels in Sports-Editor groups; logos; **`hidden_from_output`** for past-date event channels (opt-in per group), a global hide that otpravkarr's profiles can't override; a `restart_dispatcharr` action. | None | **Key renamed**: the old adapter's `epgeditarr` key no longer matches, and settings migrate to the new key. "Keep its rename/sort actions away from Lineuparr" is stale: v0.5.x has no rename/sort *actions*. Add: `hidden_from_output` and logos. |
| Lineuparr (`lineuparr`) | [PiratesIRC/…Lineuparr-Plugin](https://github.com/PiratesIRC/Dispatcharr-Lineuparr-Plugin/tree/b4d129d497619ebc8fe47bc8b36029c7ad3c2974) v1.26.2901915 (`b4d129d`) | Groups (`get_or_create` by name, so it adopts existing groups); channels (`get_or_create`, renumbers); replaces streams; EPG and logos; **deletes every zero-stream channel in groups matching its lineup names, including ones it didn't create**, on Apply Stream Match as well as Full Sync. | Only profiles named in `channel_profiles` (default `_none`, meaning none). It creates enabled rows and flips disabled ones on. | Confirmed, with two refinements: profile enabling covers only the configured profiles, and deletion isn't limited to Full Sync. |

**Plugin REST surface** ([`apps/plugins/api_urls.py#L23-L41`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/plugins/api_urls.py#L23-L41), [`api_views.py#L95-L116`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/plugins/api_views.py#L95-L116), [`loader.py#L420-L541`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/plugins/loader.py#L420-L541)):

- **Listing.** `GET /api/plugins/plugins/` (Standard or above) returns `{"plugins":[…]}`. Each entry has:
  - `key, name, version, description, author, help_url`;
  - `enabled, ever_enabled`;
  - `fields, settings, actions`;
  - `missing, trusted, loaded, legacy`;
  - `logo_url, source_repo, source_repo_name, is_official_repo, slug, is_managed`;
  - `installed_version_is_prerelease, update_available, latest_version, deprecated`.
- **Settings are the raw stored dict, without defaults merged in.** A reader must apply `fields[].default` itself, or a plugin left at defaults (for example IPTV Checker's "Graveyard") reads as "no setting".
- **Disabled plugins aren't imported.** They report only the `fields` in their `plugin.json`. Stream Mapparr, Lineuparr and ESE ship `fields: []` and build them at runtime.
- **Writes.** `POST …/<key>/settings/` replaces the whole dict; there is no per-plugin GET. `…/run/` and `…/enabled/` are admin-only. otpravkarr stays read-only.
- **Events.** Plugins subscribe through an action's `events` list, using the same names as Connect (`m3u_refresh`, `epg_refresh`, `channel_*`, `client_*`, …; [`apps/connect/models.py#L3-L24`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/connect/models.py#L3-L24)). There are **no channel, group or profile change events**.
- **Trust.** Plugins are in-process, trusted Django code with unrestricted ORM access, threads and signals (`Plugins.md`; [`loader.py#L299-L387`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/plugins/loader.py#L299-L387)). "What a plugin may write" is therefore convention, not something Dispatcharr enforces.

**The ownership split, corrected.**

- Lineuparr owns lineups: groups, channels and numbering in its lineup groups, plus enabling in the profiles *it is configured for*.
- ECM owns visibility in the profiles named in its scope, in both directions.
- Stream Mapparr can only narrow its single configured profile, and only by manual action.
- ESE owns virtual, fill and sports EPG, plus global `hidden_from_output` for past events.
- IPTV Checker owns quarantine moves, renames and deletes.
- Channel Mapparr owns names and grouping.
- EPG Janitor, ECM and ESE all write EPG.
- **Dispatcharr core** (auto-sync, API channel creation, new-profile back-fill) widens every profile by default.
- otpravkarr owns user→profile assignment, its own profiles' membership, and the managed users' credentials and custom properties.

The collision to check: if any plugin's profile setting (ECM `channel_profile_name`, Stream Mapparr `profile_name`, Lineuparr `channel_profiles`) names an otpravkarr-owned profile, that plugin co-owns the profile's membership. That is intended for ECM on event profiles and a conflict everywhere else.

## 7. Options for delivery

Goals, from the spec:

- Per-friend access that ends when the friendship ends.
- Least privilege, where zero groups means zero channels.
- No video proxying.
- Credentials masked and rotatable.
- Converge despite plugin churn.

The spec's §12 weaknesses in play: orphaned remote accounts, credentials in URLs, drift, and empty-profile exposure.

| Option | Per-user identity and revocation | Scoping | Credential handling | Orphans and drift | Fit |
|---|---|---|---|---|---|
| **A. Per-user Dispatcharr account, XC credentials, one profile per group (status quo, "Model A")** | Yes. Rotate or remove `xc_password`, or delete the user. | Union of group profiles; enforced at stream time; VOD needs the explicit flags. | Long-lived password in URLs; `stream_limit` limits sharing. | otpravkarr must reconcile remote users and profiles; core auto-sync widens profiles until the next reconcile. | **Best fit.** Strengthen with candidates 1–9 (D21–D24). |
| A2. Like A, but one profile per *user* | Yes | The user's exact set | Same as A | N profiles to keep narrowed, and every one widened by auto-sync; ECM scope must list every user's profile; more profile churn. | Worse than A for ECM and for scale (tens of users, up to ~1000 groups). |
| B. Per-profile `/output/m3u/<profile>` + `/output/epg/<profile>` (+HDHR) | **No.** Anyone with the URL gets the profile, and one person can't be revoked. | Profile | No credentials at all; streams use unauthenticated `/proxy/ts/stream/<uuid>`. | No user objects, but the profile name is effectively a shared secret. | **Reject.** Upstream docs advise against publishing it. |
| C1. otpravkarr serves the playlist (fetches `get.php` server-side, or redirects from its own revocable token URL) | Yes, through otpravkarr tokens | Same as A | Stream lines still contain `/live/<user>/<xc_password>/…`, so the secret leaks anyway; a redirect also exposes it. | Adds an availability dependency on otpravkarr for every playlist refresh. | Low value. It would only help if otpravkarr also proxied video, which is a non-goal. |
| C2. otpravkarr proxies streams and re-signs URLs | Yes | Yes | Hides the XC credential completely | Big operational cost: bandwidth, latency, a second stream proxy. | **Reject** (non-goal, spec §1). |
| D. Shared XC account per lineup or bundle | **No.** Revoking one friend means rotating everyone. | Lineup | One credential shared by many | Fewer remote users | Reject. It breaks "access ends when the friendship ends". |
| E. Newer upstream mechanisms | Reverse-proxy header auth (v0.32.0): UI JWTs only. Catch-up session API (v0.28.0): app playback sessions, not playlists. App-data API (dev): storage only. | — | — | App-data gives a clean ownership marker. | None of these replaces A. Use app-data for the marker once it ships. |

Option A, hardened:

- **Streamer level, and a throwaway login password.** This closes UI/REST exposure and separates the login password from the XC credential.
- **`start_empty` profiles.** No all-channels window when a profile is created.
- **Explicit VOD, catch-up and adult flags, and `stream_limit`.**
- **An ownership marker on each remote user.** Orphans can be found and adopted or deleted (spec §12: "remote account orphaned with no record of its ID").
- **Disable by clearing `xc_password`, alongside the empty profile.**
  - It is reversible and keeps the Dispatcharr user ID, so bookmarked URLs work again after re-enable with a stored or rotated password.
  - It avoids the create/delete churn that produces orphans.
  - Hard deletion stays the path for permanent removal.
- **A reconcile triggered by the Dispatcharr Connect `m3u_refresh` webhook, plus a check for empty-list users on every sync.** Together they shrink the core auto-sync exposure window and catch the cascade case.
  - Connect webhooks carry configurable headers and no signature ([`apps/connect/handlers/webhook.py#L10-L19`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/connect/handlers/webhook.py#L10-L19)).
  - The event fires after auto-sync completes ([`apps/m3u/tasks.py#L3938`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/m3u/tasks.py#L3938), [`#L4001-L4010`](https://github.com/Dispatcharr/Dispatcharr/blob/c52bf87acb7ff2d787d6dcfb9fe3d39999585912/apps/m3u/tasks.py#L4001-L4010)).

## Where the spec is wrong or stale

- **§3, §6.5 and §10, "highest non-admin user level".** That level is Standard, and it grants UI and REST read access well beyond the profiles. Least privilege only holds at Streamer.
- **§6.5 and §1, "a freshly created profile starts with every channel enabled".** Still the default, but `start_empty` has existed since v0.30.0.
- **§5.2, "Dispatcharr has no inactive user flag".** True over REST (`is_active` isn't serialised), but clearing `xc_password` disables every XC path without deleting the account.
- **§6.4, "a remote lookup by exact username".** There is no server-side filter; the full user list is fetched, including every user's `api_key`.
- **§1 and §6.5, exposure framing.** The main widening force is core Auto Channel Sync (every M3U refresh) and API channel creation, not only plugins. VOD (and catch-up) exposure is missing from the spec entirely.
- **§7.3 rows.** Corrections are in §6:
  - IPTV Checker has no webhook, and it renames and deletes channels.
  - Stream Mapparr's "refuses All" isn't in the code, and its webhook is gone.
  - EPGeditARR's key is now `epg_and_sports_editor`, and it has no rename/sort actions.
  - ECM's schedule and m3u triggers are opt-in, it re-enables as well as hides, and it writes EPG.
  - Lineuparr deletes zero-stream channels outside Full Sync too.
- **§6.8, event-group suffixes.** These are this deployment's naming convention, not something ECM defines.

## Candidate decisions

The owner has reviewed all 20; each is now a decision in [`docs/decisions.md`](../decisions.md):

| Candidates | Decision |
|---|---|
| 1 (Streamer level), 2 (random login password), 3 (self-managed and staff modes, dropped), 12 (no proxying), 20 (provider URLs hidden from Standard users: moot, as no subscriber is Standard) | D21 |
| 7 (content flags and `stream_limit`) | D22 |
| 4 (`start_empty`), 5 (disable by clearing `xc_password`), 6 (ownership marker), 10 (incidents) | D23 |
| 8 (auto-sync widening), 9 (`m3u_refresh` webhook), 17 (plugin registry), 18 (plugin advisories), 19 (`hidden_from_output`) | D24 |
| 13 (service user), 14 (`X-API-Key`, stripping `api_key`) | D25 |
| 4 (version floor, replaced by D30), 15 (health probe), 16 (compatibility gate, contract tests), 20 (failed-auth rate limits: no fake-credential probes) | D26 |
| 11 (delivery and exposure), 20 (`XC_API` network rule: the owner's ingress notes) | D19, with D20 open |
