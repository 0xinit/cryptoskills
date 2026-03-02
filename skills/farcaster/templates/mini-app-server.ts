import express from "express";
import crypto from "node:crypto";
import path from "node:path";

const app = express();
const WEBHOOK_SECRET = process.env.NEYNAR_WEBHOOK_SECRET;
const PORT = process.env.PORT ?? 3000;
const APP_DOMAIN = process.env.APP_DOMAIN ?? "localhost:3000";

if (!WEBHOOK_SECRET) {
  throw new Error("NEYNAR_WEBHOOK_SECRET is required");
}

// Raw body on webhook route for signature verification
app.use("/api/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Farcaster manifest -- domain in accountAssociation.payload MUST match APP_DOMAIN
app.get("/.well-known/farcaster.json", (_req, res) => {
  res.json({
    accountAssociation: {
      header: process.env.FC_ASSOC_HEADER ?? "",
      payload: process.env.FC_ASSOC_PAYLOAD ?? "",
      signature: process.env.FC_ASSOC_SIGNATURE ?? "",
    },
    frame: {
      version: "1",
      name: "My Mini App",
      iconUrl: `https://${APP_DOMAIN}/icon.png`,
      homeUrl: `https://${APP_DOMAIN}/app`,
      splashImageUrl: `https://${APP_DOMAIN}/splash.png`,
      splashBackgroundColor: "#1a1a2e",
      webhookUrl: `https://${APP_DOMAIN}/api/webhook`,
    },
  });
});

app.get("/app", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="fc:frame" content='${JSON.stringify({
    version: "next",
    imageUrl: `https://${APP_DOMAIN}/og.png`,
    button: {
      title: "Open App",
      action: {
        type: "launch_frame",
        name: "My Mini App",
        url: `https://${APP_DOMAIN}/app`,
        splashImageUrl: `https://${APP_DOMAIN}/splash.png`,
        splashBackgroundColor: "#1a1a2e",
      },
    },
  })}' />
  <title>My Mini App</title>
  <script type="module">
    import sdk from "https://esm.sh/@farcaster/frame-sdk";
    const context = await sdk.context;
    document.getElementById("user").textContent =
      context.user.displayName + " (@" + context.user.username + ")";
    sdk.actions.ready();
  </script>
</head>
<body style="font-family: system-ui; padding: 16px;">
  <h1>Welcome, <span id="user">loading...</span></h1>
</body>
</html>`);
});

// Webhook with HMAC-SHA512 verification
app.post("/api/webhook", (req, res) => {
  const rawBody = req.body as Buffer;
  const signature = req.headers["x-neynar-signature"];

  if (typeof signature !== "string") {
    res.status(401).json({ error: "Missing signature" });
    return;
  }

  const hmac = crypto.createHmac("sha512", WEBHOOK_SECRET);
  hmac.update(rawBody);
  const computed = hmac.digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const computedBuf = Buffer.from(computed, "hex");

  if (
    sigBuf.length !== computedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, computedBuf)
  ) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const event = JSON.parse(rawBody.toString("utf-8"));
  console.log(`Webhook event: ${event.type}`, JSON.stringify(event.data));

  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Mini App server running on port ${PORT}`);
});
