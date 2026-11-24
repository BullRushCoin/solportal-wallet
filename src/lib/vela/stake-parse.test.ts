import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nativeStakeStatus } from "./stake.ts";
import {
  parseBlazeApy,
  parseJsonParsedStakeAccounts,
  parseSanctumSolValues,
  parseSanctumTvl,
  parseStakewizEpoch,
  parseStakewizValidators,
  parseVoteAccounts,
} from "./stake-parse.ts";

describe("stake parsers", () => {
  it("reads Sanctum TVL and sol-per-token in lamports", () => {
    const tvl = parseSanctumTvl({ tvls: { JitoSOL: "10416036201379766" } });
    assert.ok((tvl.JitoSOL ?? 0) > 10_416_036 && (tvl.JitoSOL ?? 0) < 10_416_037);
    const rates = parseSanctumSolValues({ solValues: { JitoSOL: "1275866054" } });
    assert.ok(Math.abs(rates.JitoSOL! - 1.275866054) < 1e-9);
  });

  it("reads Blaze APY as a percent", () => {
    assert.equal(parseBlazeApy({ success: true, apy: 4.9, total: 4.9 }), 4.9);
  });

  it("ranks Stakewiz validators, skipping delinquents and 100% commission", () => {
    const rows = parseStakewizValidators(
      [
        { vote_identity: "Vote111111111111111111111111111111111111111", name: "Keep", commission: 5, activated_stake: 1000, total_apy: 5.1, delinquent: false, image: "https://example.com/v.png" },
        { vote_identity: "Vote222222222222222222222222222222222222222", name: "Skip", commission: 100, activated_stake: 99999, total_apy: 9, delinquent: false },
        { vote_identity: "Vote333333333333333333333333333333333333333", name: "Late", commission: 0, activated_stake: 5000, total_apy: 5, delinquent: true },
      ],
      12,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.name, "Keep");
    assert.equal(rows[0]?.apyPct, 5.1);
    assert.equal(rows[0]?.image, "https://example.com/v.png");
  });

  it("parses epoch info and vote accounts", () => {
    const epoch = parseStakewizEpoch({ epoch: 1095, duration_seconds: 100, elapsed_seconds: 25, remaining_seconds: 75 });
    assert.equal(epoch?.epoch, 1095);
    assert.equal(epoch?.progressPct, 25);
    const votes = parseVoteAccounts(
      { result: { current: [{ votePubkey: "Vote111111111111111111111111111111111111111", nodePubkey: "Node", activatedStake: 2_000_000_000, commission: 5 }] } },
      5,
      8,
    );
    assert.equal(votes[0]?.activatedStakeSol, 2);
    assert.ok(votes[0]?.apyPct !== null && Math.abs((votes[0]?.apyPct ?? 0) - 4.75) < 1e-9);
  });

  it("parses jsonParsed stake accounts and maps status from the live epoch", () => {
    const positions = parseJsonParsedStakeAccounts(
      {
        result: [
          {
            pubkey: "Stake11111111111111111111111111111111111112",
            account: {
              lamports: 1,
              data: {
                parsed: {
                  info: {
                    meta: { authorized: { staker: "Staker", withdrawer: "Owner" } },
                    stake: {
                      delegation: {
                        voter: "Vote111111111111111111111111111111111111111",
                        stake: 5_000_000_000,
                        activationEpoch: 1094,
                        deactivationEpoch: "18446744073709551615",
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      1095,
    );
    assert.equal(positions[0]?.amountSol, 5);
    assert.equal(positions[0]?.status, "active");
    assert.equal(positions[0]?.deactivationEpoch, null);
    assert.equal(nativeStakeStatus(1095, null, 1095), "activating");
    assert.equal(nativeStakeStatus(1094, 1096, 1095), "deactivating");
    assert.equal(nativeStakeStatus(1094, 1095, 1095), "inactive");
  });
});
