const { authorQuality } = require("../../src/pipeline/quality");
const reddit = require("../../src/connectors/reddit");

describe("authorQuality", () => {
  it("is 1 for a normal post", () => {
    expect(
      authorQuality({
        author: { account_age_days: 800, followers: 200 },
        text: "I think NVDA has room to run after this datacenter update."
      })
    ).toBe(1);
  });

  it("penalises brand-new accounts", () => {
    expect(
      authorQuality({
        author: { account_age_days: 3 },
        text: "some normal length opinion about the market today"
      })
    ).toBeLessThan(0.6);
  });

  it("penalises a link drop with almost no text", () => {
    expect(authorQuality({ author: {}, text: "check this https://spam.example/x" })).toBeLessThan(
      0.6
    );
  });

  it("penalises emoji spam", () => {
    expect(authorQuality({ author: {}, text: "🚀🚀🚀🚀🚀🚀🚀🚀" })).toBeLessThan(0.8);
  });
});

describe("reddit connector", () => {
  it("is disabled without credentials", () => {
    expect(reddit.enabled).toBe(false);
  });

  it("only applies to asset classes with configured subs", () => {
    const { normalizeAsset } = require("../../src/services/assetService");
    expect(reddit.appliesTo(normalizeAsset("BTC"))).toBe(true);
    expect(reddit.appliesTo(normalizeAsset("AAPL"))).toBe(true);
  });

  it("mapListing maps title+selftext, engagement and subreddit source", () => {
    const now = Math.floor(Date.now() / 1000);
    const children = [
      {
        data: {
          id: "abc",
          title: "Why I'm long NVDA",
          selftext: "Datacenter demand keeps surprising to the upside.",
          permalink: "/r/stocks/comments/abc/",
          created_utc: now,
          author: "dd_guy",
          ups: 340,
          num_comments: 88,
          subreddit: "stocks",
          total_awards_received: 2
        }
      },
      { data: { id: "old", title: "old", created_utc: now - 30 * 86400 } }
    ];
    const docs = reddit.mapListing(children, (now - 7 * 86400) * 1000, 25);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      title: "Why I'm long NVDA",
      author_handle: "dd_guy",
      external_id: "reddit:abc"
    });
    expect(docs[0].engagement.upvotes).toBe(340);
    expect(docs[0].provider_meta.source_name).toBe("reddit:stocks");
  });
});
