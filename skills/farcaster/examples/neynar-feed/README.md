# Fetch and Display a Farcaster Feed

Working TypeScript example for fetching a user's Farcaster feed using the Neynar API v2 SDK, including user lookup and cast rendering.

## Dependencies

```bash
npm install @neynar/nodejs-sdk
```

## Setup

```typescript
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

const config = new Configuration({
  apiKey: process.env.NEYNAR_API_KEY,
});

const neynar = new NeynarAPIClient(config);
```

## Fetch User Profile

```typescript
interface UserProfile {
  fid: number;
  username: string;
  displayName: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  pfpUrl: string;
}

async function getUserProfile(fid: number): Promise<UserProfile> {
  const { users } = await neynar.fetchBulkUsers({ fids: [fid] });
  if (users.length === 0) {
    throw new Error(`No user found for FID ${fid}`);
  }

  const user = users[0];
  return {
    fid: user.fid,
    username: user.username,
    displayName: user.display_name,
    bio: user.profile.bio.text,
    followerCount: user.follower_count,
    followingCount: user.following_count,
    pfpUrl: user.pfp_url,
  };
}
```

## Fetch Following Feed

Retrieves casts from users that the specified FID follows.

```typescript
// Farcaster epoch: January 1, 2021 00:00:00 UTC
const FARCASTER_EPOCH = 1609459200;

interface FeedCast {
  hash: string;
  author: string;
  text: string;
  timestamp: Date;
  likes: number;
  recasts: number;
  replies: number;
  embeds: string[];
}

async function getFollowingFeed(
  fid: number,
  limit: number = 25
): Promise<FeedCast[]> {
  const feed = await neynar.fetchFeed({
    feedType: "following",
    fid,
    limit,
  });

  return feed.casts.map((cast) => ({
    hash: cast.hash,
    author: `@${cast.author.username}`,
    text: cast.text,
    timestamp: new Date((cast.timestamp + FARCASTER_EPOCH) * 1000),
    likes: cast.reactions.likes_count,
    recasts: cast.reactions.recasts_count,
    replies: cast.replies.count,
    embeds: cast.embeds.map((e) => e.url).filter(Boolean),
  }));
}
```

## Fetch Channel Feed

```typescript
async function getChannelFeed(
  channelId: string,
  limit: number = 25
): Promise<FeedCast[]> {
  const feed = await neynar.fetchFeed({
    feedType: "filter",
    filterType: "channel_id",
    channelId,
    limit,
  });

  return feed.casts.map((cast) => ({
    hash: cast.hash,
    author: `@${cast.author.username}`,
    text: cast.text,
    timestamp: new Date((cast.timestamp + FARCASTER_EPOCH) * 1000),
    likes: cast.reactions.likes_count,
    recasts: cast.reactions.recasts_count,
    replies: cast.replies.count,
    embeds: cast.embeds.map((e) => e.url).filter(Boolean),
  }));
}
```

## Search Users

```typescript
async function searchUsers(query: string, limit: number = 5) {
  const result = await neynar.searchUser({ q: query, limit });

  return result.result.users.map((user) => ({
    fid: user.fid,
    username: user.username,
    displayName: user.display_name,
    followerCount: user.follower_count,
  }));
}
```

## Complete Usage

```typescript
async function main() {
  const profile = await getUserProfile(3);
  console.log(`${profile.displayName} (@${profile.username})`);
  console.log(`Followers: ${profile.followerCount}`);

  console.log("\n--- Following Feed ---");
  const feed = await getFollowingFeed(3, 10);
  for (const cast of feed) {
    console.log(`${cast.author} (${cast.timestamp.toISOString()})`);
    console.log(`  ${cast.text.slice(0, 100)}`);
    console.log(`  Likes: ${cast.likes} | Recasts: ${cast.recasts} | Replies: ${cast.replies}`);
  }

  console.log("\n--- Ethereum Channel ---");
  const channelFeed = await getChannelFeed("ethereum", 5);
  for (const cast of channelFeed) {
    console.log(`${cast.author}: ${cast.text.slice(0, 80)}`);
  }
}

main().catch(console.error);
```

## Notes

- The Neynar API key must be set in `NEYNAR_API_KEY` environment variable
- Feed responses are paginated -- use the `cursor` field from the response for subsequent pages
- Rate limits depend on your Neynar plan (Free: 5 req/s, Starter: 20 req/s)
- Timestamps from the Neynar API may be returned as Farcaster epoch seconds or ISO strings depending on the endpoint -- always check the response format
