# BlackRoad API Keys

Secure API key management service for BlackRoad.

## Live

- **Dashboard**: https://blackroad-keys.amundsonalexa.workers.dev
- **API**: https://blackroad-keys.amundsonalexa.workers.dev/api/keys

## Features

- **Create Keys** - Generate secure API keys with custom scopes
- **Key Rotation** - Rotate keys instantly without downtime
- **Revoke Keys** - Immediately disable compromised keys
- **Usage Tracking** - Monitor requests per key
- **Rate Limiting** - Per-key rate limit configuration
- **Multiple Environments** - Production, Development, CI/CD prefixes
- **8 Scopes** - Granular permission control

## Key Formats

| Environment | Prefix | Example |
|-------------|--------|---------|
| Production | `br_live_` | `br_live_Ax7Kp2...` |
| Development | `br_test_` | `br_test_Bm9Lq3...` |
| CI/CD | `br_ci_` | `br_ci_Cn0Mr4...` |

## Scopes

| Scope | Description |
|-------|-------------|
| `read` | Read access to resources |
| `write` | Create and update resources |
| `delete` | Delete resources |
| `deploy` | Deploy services |
| `admin` | Full administrative access |
| `webhooks` | Manage webhooks |
| `email` | Send emails |
| `agents` | Manage agents |

## API

### GET /api/keys
List all API keys.

### POST /api/keys
Create a new key.

```json
{
  "name": "My Key",
  "environment": "live",
  "scopes": ["read", "write"],
  "rateLimit": 1000
}
```

### GET /api/keys/:id
Get key details.

### DELETE /api/keys/:id
Revoke a key.

### POST /api/keys/:id/rotate
Rotate a key (generate new secret).

### POST /api/verify
Verify a key and get scopes.

```json
{ "key": "br_live_..." }
```

### GET /api/scopes
List available scopes.

## Development

```bash
npm install
npm run dev      # Local development
npm run deploy   # Deploy to Cloudflare
```

## License

Proprietary - BlackRoad OS, Inc.
