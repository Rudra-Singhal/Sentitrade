const twitter = require("../../src/connectors/twitter");
const { normalizeAsset } = require("../../src/services/assetService");

describe("twitter connector", () => {
  it("is disabled without any credentials", () => {
    expect(twitter.enabled).toBe(false);
  });

  it("buildQuery uses the cashtag + a name term and excludes retweets", () => {
    const q = twitter.buildQuery(normalizeAsset("AAPL"));
    expect(q).toMatch(/\$AAPL/);
    expect(q).toMatch(/-is:retweet/);
    expect(q).toMatch(/lang:en/);
  });

  it("mapOfficial joins tweets with their authors", () => {
    const payload = {
      data: [
        {
          id: "1",
          text: "$AAPL looking strong into earnings",
          author_id: "u1",
          created_at: "2026-09-10T10:00:00.000Z",
          public_metrics: { like_count: 12, retweet_count: 3, reply_count: 1 }
        }
      ],
      includes: {
        users: [
          {
            id: "u1",
            username: "trader",
            public_metrics: { followers_count: 900 },
            created_at: "2020-01-01T00:00:00Z"
          }
        ]
      }
    };
    const docs = twitter.mapOfficial(payload, 25);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      text: "$AAPL looking strong into earnings",
      author_handle: "trader",
      author_followers: 900,
      external_id: "twitter:1"
    });
    expect(docs[0].author_account_age_days).toBeGreaterThan(1000);
    expect(docs[0].engagement.likes).toBe(12);
  });

  it("mapTwitterApiIo handles the reseller shape", () => {
    const payload = {
      tweets: [
        {
          id: "9",
          text: "reliance jio adds subscribers",
          createdAt: "2026-09-10T09:00:00.000Z",
          author: { userName: "in_investor", followers: 2000 },
          likeCount: 5,
          retweetCount: 1
        }
      ]
    };
    const docs = twitter.mapTwitterApiIo(payload, 25);
    expect(docs[0]).toMatchObject({ author_handle: "in_investor", author_followers: 2000 });
    expect(docs[0].provider_meta.source_name).toBe("twitter");
  });
});
