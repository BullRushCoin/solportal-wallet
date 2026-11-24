import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSolanaAddress } from "./address.ts";
import { DEFAULT_FEE_WALLET, feeAccountForToken, feeWalletAddress } from "./fee-wallet.ts";
import { tokenBySymbol } from "./tokens.ts";

describe("feeWalletAddress", () => {
  it("defaults to Joe's public fee wallet and is a valid pubkey", () => {
    assert.equal(DEFAULT_FEE_WALLET, "GD5z4HJRrG6MTwrtceeu3W7mtHwZp7vBtQGkCHJrjJ2c");
    assert.equal(isSolanaAddress(DEFAULT_FEE_WALLET), true);
    assert.equal(feeWalletAddress(), DEFAULT_FEE_WALLET);
  });

  it("uses the USDC ATA of the fee wallet, not the owner address, as the Jupiter fee account", () => {
    const ata = feeAccountForToken(tokenBySymbol("USDC"));
    assert.equal(ata, "B8SfDeR7J7QLT5tAsGZahUBEdY9konVoUxYq6gC4wXT9");
    assert.notEqual(ata, feeWalletAddress());
    assert.equal(isSolanaAddress(ata), true);
  });
});
