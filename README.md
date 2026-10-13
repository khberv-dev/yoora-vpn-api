# Yoora VPN API

NestJS control API for allocating client IPs and adding WireGuard peers on the local server.

## Setup

```sh
npm install
cp .env.example .env
# Set WG_API_KEY to a nonempty API key (no minimum length).
npm run build
node --env-file=.env dist/main.js
```

The API listens on port 8000. The public health endpoint is `GET /`.

The host must have `wg` and `wg-quick` installed, with `wg0` already running at `10.0.0.1/24`. The API process needs permission to inspect/configure that interface and save `/etc/wireguard/wg0.conf`. Configure server forwarding, firewall rules and NAT separately if clients need internet access. Set up the interface to start on boot using its saved configuration. Use HTTPS when exposing the API remotely.

Environment variables:

| Variable          | Default                 | Meaning                                                 |
| ----------------- | ----------------------- | ------------------------------------------------------- |
| `WG_API_KEY`      | Required                | Nonempty key supplied as `x-api-key`; no minimum length |
| `WG_INTERFACE`    | `wg0`                   | Existing WireGuard interface                            |
| `WG_STATE_FILE`   | `./data/wireguard.json` | Persistent reservations; keep on durable local storage  |
| `WG_BINARY`       | `wg`                    | WireGuard executable path                               |
| `WG_QUICK_BINARY` | `wg-quick`              | Configuration persistence executable path               |

Node loads `.env` with `--env-file`; Nest's start scripts require these variables to be exported in the environment.

## Allocate an IP

`POST /wireguard/ip-allocations` reserves an IP for a public key without adding a peer. Allocation is optional: joining also allocates automatically.

```sh
curl -X POST http://localhost:8000/wireguard/ip-allocations \
  -H "x-api-key: $WG_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"publicKey":"YOUR_CLIENT_PUBLIC_KEY"}'
```

The requested `10.0.0.255` pool boundary is interpreted as subnet `10.0.0.0/24`, with subnet mask `255.255.255.0`. Clients receive `10.0.0.2` through `10.0.0.254` (253 addresses). `.0` is the network address, `.1` belongs to the server, and `.255` is broadcast.

Allocations are tied to public keys and do not expire. Repeating a request returns the same address. Caller-selected IPs and additional fields are rejected. Client keys must be canonical base64-encoded, nonzero 32-byte public keys. Generate keys on the client; do not send private keys to this API.

## Add a client / join

`POST /wireguard/clients` and `POST /wireguard/join` run the same operation:

```sh
curl -X POST http://localhost:8000/wireguard/join \
  -H "x-api-key: $WG_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"publicKey":"YOUR_CLIENT_PUBLIC_KEY"}'
```

The service checks live peers, reserves a free IP, then invokes these commands with an argument array and no shell:

```sh
wg show wg0 allowed-ips
wg set wg0 peer CLIENT_PUBLIC_KEY allowed-ips 10.0.0.2/32
wg-quick save wg0
```

See the [official WireGuard command reference](https://git.zx2c4.com/wireguard-tools/about/src/man/wg.8) and [wg-quick reference](https://git.zx2c4.com/wireguard-tools/about/src/man/wg-quick.8).

Successful responses (HTTP 201):

```json
{
  "publicKey": "CLIENT_PUBLIC_KEY",
  "ip": "10.0.0.2",
  "status": "active",
  "interface": "wg0",
  "address": "10.0.0.2/32",
  "subnet": "10.0.0.0/24"
}
```

Allocation returns `reserved` until a join completes; an already active allocation retains its stored status. `active` means a successful join was recorded, not that a client has completed a handshake or remains connected. Configure the client's private key, returned address, server public key, endpoint and desired routes on the client separately.

Repeated joins reuse the IP and leave an existing matching peer unchanged. Configuration saving is retried even when the peer already exists. Existing peers with multiple routes or addresses outside this pool are rejected rather than modified. Allocations also avoid addresses covered by other live peers' IPv4 CIDR ranges.

All WireGuard endpoints require the matching `x-api-key` header. The application refuses to start when `WG_API_KEY` is unset or empty.

Errors: `400` invalid input, `401` invalid/missing API key, `409` pool exhausted or conflicting peer assignment, `503` WireGuard or allocation storage unavailable.

## Persistence and concurrency

Reservations are written atomically before configuring peers. If adding a peer or saving the WireGuard configuration fails, its IP stays reserved. Retry the join with the same public key to finish; this also handles a command timeout after the peer may have been applied. A failed save may leave a live peer active but not yet saved for restart.

Use one API deployment per interface with a durable state file. In-process requests are serialized, and an exclusive filesystem lock prevents overlapping operations by processes sharing that file; a competing process receives `503` and can retry. Do not run independent deployments with separate state files for the same interface or modify peers concurrently through another control tool.

After a process crash, a `.lock` file may remain. Stop all API instances, confirm no operation is running, then remove only the stale lock before restarting. Preserve the JSON state file and WireGuard configuration. Corrupt or inconsistent state is rejected to avoid reusing allocated IPs. There is no release/delete endpoint in this implementation.

## Validation

```sh
npm run build
npm test
npm run test:e2e
npm run lint
```

Tests mock WireGuard commands and use temporary state directories; they do not alter the host VPN. HTTP integration tests require permission to bind a local socket.
