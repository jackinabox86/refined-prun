# Communication Screens (COM, COMC, COMF, COMP/COMG/COMU)

## COM — Communications

List of joined channels, each row labeled by kind: `GROUP: <name>`, `PRIVATE: <username>`, with "last activity" timestamps. Clicking a row opens the channel buffer. `new group` / `new private` buttons create channels (server). Context bar: `COMC`, `COMF`.

## COMC — Public Channel Catalog

Public channels (APEX Global Chat, Official APEX Help Channel, United Faction Operations, …) each with an `open` button → `COMP <channel>`. Context bar: `COM`.

## Channel Buffers

- `COMP <channel id>` — public channel
- `COMG <channel id>` — group conversation (corporations get one automatically: `COMG CORP-<id>`). The parameter also accepts a channel's natural id/name directly (e.g. `COMG my-group-name`), not just the raw channel-id hash — confirmed working for player-named private groups. Identifiers over ~46 chars get rejected client-side as "Illegal command" before ever reaching the server (9-13 char identifiers confirmed safe) — keep them short.
- `COMU <username>` — direct message channel

All share the chat UI: message log, user list, text input. Sending a message is a server action.

## COMF — Communication Filter

List of muted users.

## API Notes for Building on Channel Data

- Opening a channel buffer triggers a `CHANNEL_MESSAGE_LIST` push (`{channelId, messages, hasMore}`) with full history — but **only once per channel per WebSocket connection**. Reopening the same channel later in the same session produces no new inbound traffic at all (confirmed via raw socket capture), and the client's own rendered message list doesn't reliably reflect full history on a second open either. Design around this: do the full fetch once per session and track anything sent during the session locally, rather than expecting a fresh push on every reopen.
- `CHANNEL_CLIENT_MEMBERSHIP` (`{identifier, channelId, joined, ...}`) fires with `channelId: null, joined: false` when the requested channel doesn't exist or the user isn't a member — the clean signal for "this channel isn't set up" vs. a slow response.
- Message shape: `{messageId, type: 'JOINED'|'CHAT'|..., sender: {id, username} | null, message: string | null, time: {timestamp}, channelId, deletingUser}`.
- `CHANNEL_DATA` (`{channelId, type, displayName, naturalId, userCount, maxMessageLength, permissions, bans}`) has `maxMessageLength: 1000` on every captured channel — the game exposes no way to query this per-message, so treat 1000 chars as the hard cap. `naturalId`/`displayName` are `null` for private GROUP channels (only populated for PUBLIC channels) — don't rely on them to identify a specific group.
- The compose input (bottom of the chat UI) has no `<form>` to submit — see `docs/feature-patterns.md` → "Submitting a Formless Input Programmatically".
