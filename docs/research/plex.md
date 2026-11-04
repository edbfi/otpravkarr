# Plex, as the legacy app found it

Temporary research input. Everything here is from the previous otpravkarr's spec (the
`legacy-old/v1` branch), **not re-verified** against Plex today. The Plex library audit (D18) checks
it against `@ctrl/plex` and the [official Plex API](https://developer.plex.tv/); each fact is
deleted once the spec of a module that relies on it (`plex-connection`, `health`, `plex-sign-in`,
`subscriber-admin` or `sync`) absorbs or corrects it, and the file goes once none is left.

## Sign-in

- **Web sign-in uses a PIN.** The app asks plex.tv for a web-login PIN, sends the browser to Plex's
  own app domain to approve it, then polls plex.tv for the token the approved PIN carries.
- **Transient connectivity failures** reaching plex.tv were seen from hosted servers.

## Accounts and friends

- **An account** has a numeric id, a secondary opaque identifier, a username, a title or friendly
  name, an email and an avatar URL. Some accounts have a title or friendly name but no username.
- **The friends list** is read with the owner's token and gives each friend a status, which tells
  accepted friends from invites still pending.
- **The token's account:** plex.tv says which account a token belongs to.

## Servers

- **The owner's resources** list the servers the token can reach, each with its connections:
  remote HTTPS, local HTTPS, local HTTP, loopback or container-internal addresses, and Plex's relay.
- **A server reports its own identity:** a friendly name, a machine identifier and a version.
- **plex.tv and the server fail separately:** plex.tv can be down while the server, reached
  directly with a valid token, still answers.
