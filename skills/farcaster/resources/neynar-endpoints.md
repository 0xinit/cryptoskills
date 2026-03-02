# Neynar API Endpoints

> **Last verified:** March 2026

Key Neynar API v2 endpoints for reading and writing Farcaster data. Base URL: `https://api.neynar.com/v2/farcaster`

All requests require the `x-api-key` header with your Neynar API key.

## User Endpoints

| Method | Path | Description | Credits |
|--------|------|-------------|---------|
| GET | `/user/bulk?fids=3,5` | Fetch users by FID list | 1/FID |
| GET | `/user/search?q=vitalik&limit=5` | Search users by name/username | 2 |
| GET | `/user/by_username?username=dwr.eth` | Lookup user by username | 1 |
| GET | `/user/bulk-by-address?addresses=0x...` | Lookup users by connected Ethereum address | 2/addr |
| GET | `/user/{fid}/followers?limit=25` | List followers of an FID | 3 |
| GET | `/user/{fid}/following?limit=25` | List users followed by an FID | 3 |

## Cast Endpoints

| Method | Path | Description | Credits |
|--------|------|-------------|---------|
| POST | `/cast` | Publish a new cast | 10 |
| DELETE | `/cast` | Delete a cast by hash | 10 |
| GET | `/cast?identifier={hash}&type=hash` | Lookup a cast by hash | 1 |
| GET | `/cast?identifier={url}&type=url` | Lookup a cast by Warpcast URL | 1 |
| GET | `/cast/conversation/{hash}` | Get cast thread / replies | 3 |

## Feed Endpoints

| Method | Path | Description | Credits |
|--------|------|-------------|---------|
| GET | `/feed?feed_type=following&fid=3` | Following feed for an FID | 5 |
| GET | `/feed?feed_type=filter&filter_type=channel_id&channel_id=ethereum` | Channel feed | 5 |
| GET | `/feed/trending?limit=25` | Trending casts across Farcaster | 5 |
| GET | `/feed/user/casts?fid=3&limit=25` | Casts by a specific user | 3 |

## Reaction Endpoints

| Method | Path | Description | Credits |
|--------|------|-------------|---------|
| POST | `/reaction` | Add a like or recast | 10 |
| DELETE | `/reaction` | Remove a like or recast | 10 |
| GET | `/reactions?target={cast_hash}&types=likes` | Get reactions on a cast | 2 |

## Channel Endpoints

| Method | Path | Description | Credits |
|--------|------|-------------|---------|
| GET | `/channel?id=ethereum` | Lookup channel by ID | 1 |
| GET | `/channel/search?q=defi` | Search channels | 2 |
| GET | `/channel/list?limit=50` | List all channels | 3 |
| GET | `/channel/followers?id=ethereum` | Channel followers | 3 |

## Webhook Endpoints

| Method | Path | Description | Credits |
|--------|------|-------------|---------|
| POST | `/webhook` | Create a webhook subscription | 50 |
| GET | `/webhook` | List active webhooks | 1 |
| PUT | `/webhook` | Update a webhook | 50 |
| DELETE | `/webhook` | Delete a webhook | 10 |

## Signer (Managed Signer) Endpoints

| Method | Path | Description | Credits |
|--------|------|-------------|---------|
| POST | `/signer` | Create a managed signer | 50 |
| GET | `/signer?signer_uuid={uuid}` | Get signer status | 1 |
| POST | `/signer/signed_key` | Register signed key for FID | 50 |

## Rate Limits

| Plan | Requests/Second | Daily Limit |
|------|-----------------|-------------|
| Free | 5 | 100K credits |
| Starter | 20 | 1M credits |
| Growth | 50 | 10M credits |
| Scale | 200 | 60M credits |

Exceeding rate limits returns HTTP 429. Credits reset daily at midnight UTC.

## Reference

- [Neynar API Reference](https://docs.neynar.com/reference)
- [Neynar Node.js SDK](https://github.com/neynar/nodejs-sdk)
