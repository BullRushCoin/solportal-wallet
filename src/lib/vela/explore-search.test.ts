import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DISCOVER_APPS, DISCOVER_TABS, appsForTab, initialsOf } from "./discover.ts";
import { formatCount, formatTokenPrice, hostOf, looksLikeUrl, matchApps, matchTokens } from "./explore-search.ts";
import { rssItemImage } from "./social.ts";

describe("looksLikeUrl", () => {
  it("accepts domains and http(s) URLs", () => {
    for (const input of ["jup.ag", "app.kamino.finance/lend", "https://example.com", "http://x.io:8080/a?b=c", "magiceden.io"]) {
      assert.equal(looksLikeUrl(input), true, input);
    }
  });
  it("rejects plain words, numbers and phrases", () => {
    for (const input of ["", "bonk", "jupiter swap", "1.5", "sol.", ".ag", "javascript:alert(1)"]) {
      assert.equal(looksLikeUrl(input), false, input);
    }
  });
});

describe("discover catalog", () => {
  it("every tab has apps and every app has a logo and https url", () => {
    for (const tab of DISCOVER_TABS) assert.ok(appsForTab(tab).length >= 3, tab);
    for (const app of DISCOVER_APPS) {
      assert.match(app.url, /^https:\/\//);
      assert.match(app.logo, /^https:\/\//);
      assert.ok(app.tagline.length > 0 && app.tagline.length <= 60, app.id);
    }
    assert.equal(new Set(DISCOVER_APPS.map((app) => app.id)).size, DISCOVER_APPS.length);
  });
  it("matches by name and keyword", () => {
    assert.deepEqual(matchApps(DISCOVER_APPS, "jitosol").map((app) => app.id), ["jito"]);
    assert.ok(matchApps(DISCOVER_APPS, "lend").some((app) => app.id === "kamino"));
  });
  it("makes initials", () => {
    assert.equal(initialsOf("Magic Eden"), "ME");
    assert.equal(initialsOf("pump.fun"), "PF");
    assert.equal(initialsOf("Orca"), "OR");
  });
});

describe("matchTokens", () => {
  const tokens = [
    { mint: "m1", symbol: "BONKER", name: "Bonker", decimals: 6, image: null, priceUsd: null },
    { mint: "m2", symbol: "BONK", name: "Bonk", decimals: 5, image: null, priceUsd: 0.00002 },
    { mint: "m2", symbol: "BONK", name: "Bonk dup", decimals: 5, image: null, priceUsd: null },
    { mint: "m3", symbol: "WIF", name: "dogwifhat", decimals: 6, image: null, priceUsd: 1 },
  ];
  it("ranks exact symbols first and dedupes mints", () => {
    assert.deepEqual(matchTokens(tokens, "bonk").map((token) => token.mint), ["m2", "m1"]);
    assert.deepEqual(matchTokens(tokens, "dogwif").map((token) => token.mint), ["m3"]);
  });
});

describe("formatters", () => {
  it("formats prices and counts", () => {
    assert.equal(formatTokenPrice(null), "—");
    assert.equal(formatTokenPrice(123.456), "$123.46");
    assert.equal(formatTokenPrice(0.0000123), "$0.0000123");
    assert.equal(formatCount(950), "950");
    assert.equal(formatCount(1234), "1.2K");
    assert.equal(formatCount(25_000), "25K");
    assert.equal(formatCount(2_500_000), "2.5M");
    assert.equal(hostOf("https://www.coindesk.com/x"), "coindesk.com");
  });
});

describe("rssItemImage", () => {
  it("reads media:thumbnail, media:content, enclosure and inline img", () => {
    assert.equal(rssItemImage('<item><media:thumbnail url="https://a.com/t.png" width="1"/></item>'), "https://a.com/t.png");
    assert.equal(rssItemImage('<item><media:content url="https://a.com/c.jpg?w=8&amp;h=4" type="image/*"/></item>'), "https://a.com/c.jpg?w=8&h=4");
    assert.equal(rssItemImage('<item><media:content url="https://a.com/v.mp4" type="video/mp4"/></item>'), null);
    assert.equal(rssItemImage('<item><enclosure url="https://a.com/e.png" type="image/png"/></item>'), "https://a.com/e.png");
    assert.equal(rssItemImage('<item><description><![CDATA[<p><img src="https://a.com/i.webp"></p>]]></description></item>'), "https://a.com/i.webp");
    assert.equal(rssItemImage("<item><title>x</title></item>"), null);
    assert.equal(rssItemImage('<item><media:thumbnail url="http://insecure.com/a.png"/></item>'), null);
  });
});
