# NFT Metadata Schema Reference

JSON metadata schemas for ERC-721 tokens, ERC-1155 tokens, and collection-level metadata.

## ERC-721 Token Metadata

Returned by `tokenURI(tokenId)`. The URI resolves to this JSON structure.

```json
{
  "name": "Token Name #1",
  "description": "Description of this specific token.",
  "image": "ipfs://QmImageHash/1.png",
  "external_url": "https://example.com/token/1",
  "animation_url": "ipfs://QmAnimationHash/1.mp4",
  "background_color": "1a1a2e",
  "attributes": [
    {
      "trait_type": "Color",
      "value": "Red"
    },
    {
      "trait_type": "Level",
      "value": 5,
      "display_type": "number"
    },
    {
      "trait_type": "Power",
      "value": 85,
      "max_value": 100
    },
    {
      "display_type": "boost_percentage",
      "trait_type": "Speed Boost",
      "value": 15
    },
    {
      "display_type": "date",
      "trait_type": "Created",
      "value": 1709251200
    }
  ]
}
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Human-readable name of the token |
| `description` | Yes | Text description (supports markdown on some platforms) |
| `image` | Yes | URL to the image (IPFS, Arweave, HTTPS, or data URI) |
| `external_url` | No | URL to view the token on your site |
| `animation_url` | No | URL to multimedia (video, audio, 3D model, HTML page) |
| `background_color` | No | Hex color without `#` prefix for display background |
| `attributes` | No | Array of trait objects for rarity/filtering |

### Attribute Display Types

| `display_type` | Rendering | Example |
|---------------|-----------|---------|
| _(omitted)_ | String trait | `"Color": "Red"` |
| `number` | Numeric bar | `"Level": 5` |
| `boost_number` | Numeric with `+` prefix | `"+15 Power"` |
| `boost_percentage` | Percentage with `+` prefix | `"+15% Speed"` |
| `date` | Unix timestamp as date | `"Created: Jan 1, 2025"` |

## ERC-1155 URI Template

The `uri(id)` function returns a URI template. The `{id}` placeholder is substituted client-side.

```
https://api.example.com/items/{id}.json
```

### Substitution Rules (per ERC-1155 spec)

1. Replace `{id}` with the hex representation of the token ID
2. Zero-pad to 64 characters
3. Lowercase hex
4. No `0x` prefix

| Token ID (decimal) | Substitution |
|--------------------|-------------|
| 0 | `0000000000000000000000000000000000000000000000000000000000000000` |
| 1 | `0000000000000000000000000000000000000000000000000000000000000001` |
| 255 | `00000000000000000000000000000000000000000000000000000000000000ff` |
| 10000 | `0000000000000000000000000000000000000000000000000000000000002710` |

### TypeScript Helper

```typescript
function substituteTokenId(template: string, tokenId: bigint): string {
  const hex = tokenId.toString(16).padStart(64, "0");
  return template.replace("{id}", hex);
}
```

## Collection Metadata (contractURI)

Returned by `contractURI()`. Provides collection-level information for marketplaces.

```json
{
  "name": "Collection Name",
  "description": "Description of the entire collection.",
  "image": "ipfs://QmCollectionImageHash",
  "banner_image": "ipfs://QmBannerImageHash",
  "external_link": "https://example.com",
  "collaborators": ["0xAddress1...", "0xAddress2..."],
  "seller_fee_basis_points": 500,
  "fee_recipient": "0xRoyaltyRecipientAddress..."
}
```

| Field | Description |
|-------|-------------|
| `name` | Collection name displayed on marketplace |
| `description` | Collection description |
| `image` | Collection avatar/logo image |
| `banner_image` | Wide banner image for collection page |
| `external_link` | Link to project website |
| `seller_fee_basis_points` | Royalty percentage in basis points (500 = 5%). Legacy OpenSea format. |
| `fee_recipient` | Address to receive royalties. Legacy OpenSea format. |

Note: `seller_fee_basis_points` and `fee_recipient` in contractURI are the legacy OpenSea royalty format. ERC-2981 is the standard. Both should be set for maximum compatibility.

## References

- [OpenSea Metadata Standards](https://docs.opensea.io/docs/metadata-standards)
- [ERC-721 Metadata JSON Schema](https://eips.ethereum.org/EIPS/eip-721)
- [ERC-1155 Metadata URI](https://eips.ethereum.org/EIPS/eip-1155#metadata)
