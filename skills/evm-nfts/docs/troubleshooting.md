# EVM NFTs Troubleshooting Guide

Common issues and solutions when developing ERC-721 and ERC-1155 NFT contracts and integrating with marketplaces.

## Metadata Not Showing on OpenSea

**Symptoms:**
- Collection page shows blank images and "Unnamed" tokens
- Individual token pages show no attributes

**Solutions:**

1. **`tokenURI` returns wrong format.** OpenSea expects `tokenURI(tokenId)` to return a URI pointing to a JSON document (not the image URL directly). Verify by calling `tokenURI` and checking the response is valid JSON with `name`, `description`, and `image` fields.

2. **IPFS gateway timeout.** If using `ipfs://` URIs, OpenSea resolves through its own gateway. Pin content to multiple IPFS providers (Pinata, nft.storage, Infura) to ensure availability. Test with `https://ipfs.io/ipfs/<CID>` first.

3. **Missing `contractURI()`.** Collection-level metadata (name, description, image) comes from `contractURI()`. Without it, the collection page is blank. Return a URI pointing to a JSON document with `name`, `description`, `image`, and `external_link`.

4. **Refresh required.** OpenSea caches metadata aggressively. Use the "Refresh metadata" button on individual items, or call the OpenSea API:
   ```bash
   curl -X POST "https://api.opensea.io/api/v2/chain/ethereum/contract/<address>/nfts/<tokenId>/refresh" \
     -H "X-API-KEY: $OPENSEA_API_KEY"
   ```

5. **ERC-4906 events missing.** After updating metadata, emit `MetadataUpdate(tokenId)` or `BatchMetadataUpdate(fromTokenId, toTokenId)`. Marketplaces listen for these events to trigger re-indexing.

## Gas Estimation Failure on Mint

**Symptoms:**
- `estimateGas` reverts with no useful error message
- "execution reverted" without reason string

**Solutions:**

1. **Supply cap reached.** If `_nextTokenId >= MAX_SUPPLY`, the transaction reverts. Custom errors (e.g., `MaxSupplyReached()`) provide better error messages than require strings.

2. **Mint not active.** Check if there is a `mintActive` or `claimActive` flag that must be set by the owner before minting.

3. **Allowlist check failing.** For Merkle-based allowlists, verify the proof is generated against the correct root and the address is in the allowlist. For signature-based allowlists, verify the signer address matches, the nonce is current, and the deadline has not passed.

4. **Insufficient payment.** For paid mints, `msg.value` must meet or exceed the current price. Check `currentPrice()` on Dutch auction contracts immediately before submitting.

## Revert on `_safeMint` to Contract Address

**Symptoms:**
- Mint succeeds for EOAs but reverts when minting to a contract
- Error: `ERC721InvalidReceiver`

**Solutions:**

1. **Receiver contract does not implement `IERC721Receiver`.** The `_safeMint` function calls `onERC721Received` on the receiver. If the receiver contract does not implement this interface, the call reverts. Implement the interface:
   ```solidity
   import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

   contract MyContract is IERC721Receiver {
       function onERC721Received(address, address, uint256, bytes calldata)
           external pure returns (bytes4)
       {
           return IERC721Receiver.onERC721Received.selector;
       }
   }
   ```

2. **Receiver returns wrong selector.** The function must return `IERC721Receiver.onERC721Received.selector` (bytes4 `0x150b7a02`). Returning any other value or reverting causes the mint to fail.

## ERC-1155 `{id}` URI Substitution Not Working

**Symptoms:**
- API returns 404 for token metadata
- Marketplace shows no metadata for ERC-1155 tokens

**Solutions:**

1. **Server-side substitution attempted.** The `{id}` in the URI is a client-side substitution marker defined in the ERC-1155 spec. The contract returns the raw template with `{id}` literal. Clients replace `{id}` with the hex token ID, zero-padded to 64 characters, lowercase, no `0x` prefix.

   Example for token ID `1`:
   ```
   Template:  https://api.example.com/items/{id}.json
   Resolved:  https://api.example.com/items/0000000000000000000000000000000000000000000000000000000000000001.json
   ```

2. **API endpoint mismatch.** Ensure your API handles both the padded hex format (per spec) and optionally the decimal format as a fallback. Most marketplaces follow the spec and use hex.

3. **Wrong `uri()` return.** Verify the contract's `uri(id)` function returns the correct template string. In OZ v5, the base URI is set in the constructor and `uri()` returns it for all IDs.

## `supportsInterface` Returns False for ERC-2981

**Symptoms:**
- Royalties not recognized by marketplaces
- `supportsInterface(0x2a55205a)` returns `false`

**Solutions:**

1. **Missing override.** When combining multiple inheritance (ERC721 + ERC2981), you must override `supportsInterface`:
   ```solidity
   function supportsInterface(bytes4 interfaceId)
       public view override(ERC721, ERC2981) returns (bool)
   {
       return super.supportsInterface(interfaceId);
   }
   ```

2. **Interface ID check.** ERC-2981 interface ID is `0x2a55205a`. Verify with:
   ```bash
   cast sig "royaltyInfo(uint256,uint256)"
   # Returns 0x2a55205a
   ```

## Debug Checklist

- [ ] `tokenURI(tokenId)` returns valid URI pointing to JSON (not image URL)
- [ ] JSON metadata has `name`, `description`, `image` fields
- [ ] `image` URL is accessible (test in browser)
- [ ] `contractURI()` implemented for collection metadata
- [ ] `supportsInterface` overridden for all inherited interfaces
- [ ] `ReentrancyGuard` on mint functions
- [ ] ERC-4906 events emitted on metadata changes
- [ ] IPFS content pinned to multiple providers
- [ ] ERC-1155 API handles hex-padded token IDs
