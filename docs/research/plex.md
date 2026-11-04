# Plex, as the legacy app found it

Temporary research input. Everything here is from the previous otpravkarr's spec (the
`legacy-old/v1` branch), **not re-verified** against Plex today. The Plex library audit (D18) checks
it against `@ctrl/plex` and the [official Plex API](https://developer.plex.tv/); each fact is
deleted once `plex-connection`'s or `plex-sign-in`'s spec absorbs or corrects it.

## Sign-in

- **Web sign-in uses a PIN.** The app asks plex.tv for a web-login PIN, sends the browser to Plex's
  own app domain to approve it, then polls plex.tv for the token the approved PIN carries.
- **Reaching plex.tv fails transiently** more often from hosted servers, so starting a sign-in was
  retried a few times with backoff.

## Accounts and friends

- **An account** has a numeric id, a secondary opaque identifier (a UUID), a username, a title or
  friendly name, an email and an avatar URL. Some accounts lack a username, so the display name
  falls back to the title, then the friendly name.
- **The friends list** is read with the owner's token and gives each friend a status: an invite the
  friend hasn't accepted shows as pending, and only an accepted friendship is a share.
- **The token's account:** plex.tv says which account a token belongs to. The self-subscription
  (`subscriber-admin`) keys on the account behind the server token.

## Servers

- **The owner's resources** list the servers the token can reach, each with its connections:
  remote HTTPS, local HTTPS, local HTTP, loopback or container-internal addresses, and Plex's relay.
- **A server reports its own identity:** a friendly name, a machine identifier and a version. The
  machine identifier that matters is the one the server reports, not the one plex.tv lists.
- **plex.tv and the server fail separately.** When plex.tv is down, a server reached directly with a
  valid token still answers, so the legacy health check counted that as healthy.
