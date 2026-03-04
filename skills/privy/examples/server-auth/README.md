# Server-Side JWT Verification with Privy

Working TypeScript example for an Express server that verifies Privy access tokens to protect API routes.

## Dependencies

```bash
npm install @privy-io/server-auth express
npm install -D @types/express typescript
```

## Environment Variables

```bash
# .env
PRIVY_APP_ID=your-privy-app-id          # From dashboard.privy.io
PRIVY_APP_SECRET=your-privy-app-secret   # From dashboard.privy.io > Settings > API Keys
PORT=3001
```

## Privy Client Setup

```typescript
// lib/privy.ts
import { PrivyClient } from "@privy-io/server-auth";

export const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);
```

## Auth Middleware

```typescript
// middleware/auth.ts
import type { Request, Response, NextFunction } from "express";
import { privy } from "../lib/privy";

declare global {
  namespace Express {
    interface Request {
      privyUserId?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // verifyAuthToken works ONLY with access tokens (from getAccessToken)
    // For identity tokens, use privy.getUser({ idToken }) instead
    const claims = await privy.verifyAuthToken(token);
    req.privyUserId = claims.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired access token" });
    return;
  }
}
```

## User Profile Endpoint (Identity Token)

```typescript
// routes/user.ts
import { Router } from "express";
import { privy } from "../lib/privy";

const router = Router();

router.get("/profile", async (req: Request, res: Response) => {
  const idToken = req.headers["x-id-token"] as string | undefined;
  if (!idToken) {
    res.status(400).json({ error: "Missing x-id-token header" });
    return;
  }

  try {
    const user = await privy.getUser({ idToken });
    res.json({
      id: user.id,
      email: user.email?.address ?? null,
      wallet: user.wallet?.address ?? null,
      linkedAccounts: user.linkedAccounts.map((a) => ({
        type: a.type,
        ...(a.type === "email" && { address: a.address }),
        ...(a.type === "wallet" && { address: a.address }),
        ...(a.type === "google_oauth" && { email: a.email }),
      })),
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(401).json({ error: "Invalid identity token" });
    return;
  }
});

export default router;
```

## Protected API Route

```typescript
// routes/data.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/data", requireAuth, (req: Request, res: Response) => {
  res.json({
    message: "Authenticated request",
    userId: req.privyUserId,
    timestamp: Date.now(),
  });
});

router.post("/action", requireAuth, (req: Request, res: Response) => {
  const { action, params } = req.body;

  res.json({
    success: true,
    userId: req.privyUserId,
    action,
    executedAt: Date.now(),
  });
});

export default router;
```

## Server Entry

```typescript
// server.ts
import express from "express";
import cors from "cors";
import dataRouter from "./routes/data";
import userRouter from "./routes/user";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.use("/api", dataRouter);
app.use("/api", userRouter);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

## Client-Side: Sending Tokens

```typescript
// React component using Privy hooks
import { usePrivy } from "@privy-io/react-auth";

async function fetchProtectedData(): Promise<unknown> {
  const { getAccessToken } = usePrivy();
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch("http://localhost:3001/api/data", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
```

## Notes

- **Access tokens vs identity tokens:** `verifyAuthToken` validates access tokens only. Access tokens contain the user ID and app ID but no profile data. For user profile data (email, linked accounts, wallet addresses), use `getUser({ idToken })` with an identity token.
- **App secret is required:** The `PrivyClient` constructor requires both app ID and app secret. The app secret is found in the Privy dashboard under Settings > API Keys. Never expose the app secret to the client.
- **Token refresh:** Access tokens are short-lived. The client's `getAccessToken()` auto-refreshes expired tokens. Always call `getAccessToken()` before each API request rather than caching the token.
- **CORS:** Configure `cors({ origin })` to your frontend's exact domain. Do not use `origin: '*'` in production.
- **The claims object** returned by `verifyAuthToken` contains: `userId` (Privy user ID), `appId` (your app ID), `issuer`, `issuedAt`, and `expiration`.
