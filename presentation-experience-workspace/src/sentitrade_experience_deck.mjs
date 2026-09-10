import fs from "node:fs/promises";
import path from "node:path";
import {
  Presentation,
  PresentationFile,
  row,
  column,
  grid,
  layers,
  panel,
  text,
  shape,
  chart,
  rule,
  fill,
  hug,
  fixed,
  grow,
  wrap,
  fr,
  auto,
} from "@oai/artifact-tool";

const W = 1920;
const H = 1080;
const OUT_DIR = path.resolve("output");
const SCRATCH_DIR = path.resolve("scratch");
const PREVIEW_DIR = path.join(SCRATCH_DIR, "previews");
const PPTX_PATH = path.join(OUT_DIR, "output.pptx");

const C = {
  obsidian: "#05070A",
  deep: "#080D12",
  deck: "#0B1218",
  panel: "#0E171E",
  panel2: "#101A22",
  line: "#20303D",
  dim: "#607789",
  muted: "#91A8BA",
  text: "#EDF6FA",
  green: "#37F7A5",
  cyan: "#42CFFF",
  yellow: "#FFD166",
  red: "#FF4D6D",
  violet: "#A78BFA",
  orange: "#FF9F43",
  white: "#FFFFFF",
  black: "#000000",
};

const F = {
  display: "DIN Condensed",
  body: "Avenir Next",
  mono: "Menlo",
};

const presentation = Presentation.create({
  slideSize: { width: W, height: H },
});

function tx(value, opts = {}) {
  return text(value, {
    name: opts.name,
    width: opts.width ?? fill,
    height: opts.height ?? hug,
    columnSpan: opts.columnSpan,
    rowSpan: opts.rowSpan,
    style: {
      typeface: opts.typeface ?? F.body,
      fontSize: opts.size ?? 28,
      color: opts.color ?? C.text,
      bold: opts.bold ?? false,
      italic: opts.italic ?? false,
      alignment: opts.align,
      lineSpacing: opts.lineSpacing ?? 1.08,
      wrap: opts.wrap,
    },
  });
}

function mono(value, opts = {}) {
  return tx(value, { ...opts, typeface: F.mono, size: opts.size ?? 20 });
}

function display(value, opts = {}) {
  return tx(value, {
    ...opts,
    typeface: F.display,
    bold: opts.bold ?? true,
    lineSpacing: opts.lineSpacing ?? 0.92,
  });
}

function bg() {
  return shape({
    width: fill,
    height: fill,
    fill: "linear(135deg, #05070A 0%, #071017 42%, #06160F 100%)",
  });
}

function slideChrome(slide, number, title, subtitle, body, opts = {}) {
  const root = layers(
    { width: fill, height: fill },
    [
      bg(),
      shape({
        width: fill,
        height: fixed(5),
        fill: "linear(90deg, #37F7A5 0%, #42CFFF 42%, #FF4D6D 100%)",
      }),
      column(
        {
          width: fill,
          height: fill,
          padding: { x: 76, y: 54 },
          gap: opts.gap ?? 32,
        },
        [
          row(
            { width: fill, height: hug, gap: 28, align: "start" },
            [
              column(
                { width: fixed(92), height: hug, gap: 10, padding: { top: 12 } },
                [
                  mono(String(number).padStart(2, "0"), {
                    size: 31,
                    bold: true,
                    color: C.green,
                    width: fixed(92),
                  }),
                  rule({ width: fixed(70), stroke: C.green, weight: 4 }),
                ],
              ),
              column(
                { width: fill, height: hug, gap: 8 },
                [
                  display(title, {
                    name: "slide-title",
                    size: opts.titleSize ?? 62,
                    color: C.text,
                  }),
                  subtitle
                    ? tx(subtitle, {
                        name: "subtitle",
                        size: opts.subtitleSize ?? 24,
                        color: C.muted,
                        width: wrap(opts.subtitleWidth ?? 1320),
                        lineSpacing: 1.1,
                      })
                    : null,
                ].filter(Boolean),
              ),
            ],
          ),
          body,
          row(
            { width: fill, height: hug, justify: "between", align: "center" },
            [
              mono("SentiTrade BTP Project", { width: wrap(520), size: 14, color: C.dim }),
              mono("real-time sentiment intelligence | educational signal only", {
                width: wrap(760),
                size: 14,
                color: C.dim,
                align: "right",
              }),
            ],
          ),
        ],
      ),
    ],
  );

  slide.compose(root, { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 });
}

function node(label, sub, color = C.green, opts = {}) {
  return panel(
    {
      name: opts.name,
      width: opts.width ?? fill,
      height: opts.height ?? hug,
      fill: opts.fill ?? C.panel,
      line: { fill: color, width: opts.lineWidth ?? 1.2 },
      borderRadius: "rounded-lg",
      padding: { x: opts.px ?? 22, y: opts.py ?? 18 },
    },
    column(
      { width: fill, height: hug, gap: 6 },
      [
        tx(label, {
          size: opts.labelSize ?? 25,
          bold: true,
          color: opts.labelColor ?? C.text,
          lineSpacing: 1.02,
          wrap: opts.nowrap ? "none" : undefined,
        }),
        sub
          ? tx(sub, {
              size: opts.subSize ?? 17,
              color: opts.subColor ?? C.muted,
              lineSpacing: 1.12,
            })
          : null,
      ].filter(Boolean),
    ),
  );
}

function chip(value, color = C.green) {
  return panel(
    {
      width: hug,
      height: hug,
      fill: "#081018",
      line: { fill: color, width: 1 },
      borderRadius: "rounded-full",
      padding: { x: 15, y: 7 },
    },
    mono(value, {
      width: hug,
      size: 15,
      bold: true,
      color,
      wrap: "none",
    }),
  );
}

function arrow(label = "->", width = 44) {
  return mono(label, {
    width: fixed(width),
    size: 24,
    bold: true,
    color: C.dim,
    align: "center",
  });
}

function bullet(label, detail, color = C.green) {
  return row(
    { width: fill, height: hug, gap: 18, align: "start" },
    [
      shape({ width: fixed(10), height: fixed(10), fill: color, borderRadius: "rounded-full" }),
      column(
        { width: fill, height: hug, gap: 5 },
        [
          tx(label, { size: 27, bold: true, color: C.text }),
          detail ? tx(detail, { size: 19, color: C.muted, lineSpacing: 1.14 }) : null,
        ].filter(Boolean),
      ),
    ],
  );
}

function laneTitle(label, color) {
  return row(
    { width: fill, height: hug, gap: 12, align: "center" },
    [
      shape({ width: fixed(34), height: fixed(4), fill: color }),
      mono(label, { size: 15, bold: true, color }),
    ],
  );
}

function slide1() {
  const slide = presentation.slides.add();
  slide.compose(
    layers(
      { width: fill, height: fill },
      [
        bg(),
        column(
          { width: fill, height: fill, padding: { x: 86, y: 66 }, justify: "between" },
          [
            row(
              { width: fill, height: hug, justify: "between", align: "center" },
              [
                mono("BTP PROJECT DEFENSE", { width: wrap(500), size: 18, bold: true, color: C.green }),
                mono("React | Express | MongoDB | Socket.io | VADER", {
                  width: wrap(760),
                  size: 18,
                  color: C.dim,
                  align: "right",
                }),
              ],
            ),
            column(
              { width: fill, height: hug, gap: 24 },
              [
                display("SentiTrade", {
                  name: "cover-title",
                  width: fill,
                  height: fixed(188),
                  size: 144,
                  color: C.text,
                  lineSpacing: 0.9,
                }),
                row(
                  { width: fill, height: hug, gap: 18, align: "center" },
                  [
                    shape({ width: fixed(120), height: fixed(5), fill: C.green }),
                    shape({ width: fixed(58), height: fixed(5), fill: C.cyan }),
                    shape({ width: fixed(34), height: fixed(5), fill: C.yellow }),
                    shape({ width: fixed(92), height: fixed(5), fill: C.red }),
                  ],
                ),
                tx(
                  "An explainable trading-intelligence surface that turns market price action and news sentiment into a live, auditable signal.",
                  { width: wrap(1240), size: 34, color: C.muted, lineSpacing: 1.12 },
                ),
              ],
            ),
            row(
              { width: fill, height: hug, gap: 18, align: "center" },
              [
                chip("MARKET NOISE", C.dim),
                arrow("->", 46),
                chip("HEADLINE NLP", C.green),
                arrow("->", 46),
                chip("CORRELATION", C.cyan),
                arrow("->", 46),
                chip("BUY / SELL / HOLD", C.red),
              ],
            ),
            row(
              { width: fill, height: hug, justify: "between" },
              [
                mono("Assets: BTC, ETH, AAPL", { width: wrap(520), size: 17, color: C.dim }),
                mono("Socket snapshot every 30 seconds", {
                  width: wrap(600),
                  size: 17,
                  color: C.dim,
                  align: "right",
                }),
              ],
            ),
          ],
        ),
      ],
    ),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
}

function slide2() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    2,
    "What SentiTrade Is",
    "A real-time market sentiment dashboard that fuses live charts, headline NLP, correlation analytics, and an explainable trading bias.",
    grid(
      { width: fill, height: fill, columns: [fr(1.02), fr(0.98)], columnGap: 54 },
      [
        column(
          { width: fill, height: fill, justify: "center", gap: 28 },
          [
            display("One screen. Two signals. One traceable decision.", {
              size: 72,
              color: C.text,
              lineSpacing: 0.92,
            }),
            tx(
              "The dashboard collapses the trader's context-switching loop: TradingView price action, NewsAPI headlines, VADER sentiment scores, trend aggregation, market metrics, and a rule-scored BUY / SELL / HOLD signal.",
              { size: 28, color: C.muted, lineSpacing: 1.14 },
            ),
          ],
        ),
        column(
          { width: fill, height: fill, justify: "center", gap: 20 },
          [
            node("Live price pane", "TradingView widget for BTC, ETH, and AAPL.", C.cyan),
            node("NLP sentiment pane", "VADER compound scores transformed into percent + label.", C.green),
            node("Correlation pane", "Sentiment-change and price-change compared in the same time window.", C.yellow),
            node("Signal pane", "Transparent score, confidence, reasons[], and disclaimer.", C.red),
          ],
        ),
      ],
    ),
  );
}

function slide3() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    3,
    "The Friction It Removes",
    "The project is not trying to predict the market. It is compressing multiple noisy inputs into an explainable decision-support layer.",
    grid(
      { width: fill, height: fill, columns: [fr(1), fr(0.18), fr(1)], columnGap: 24 },
      [
        column(
          { width: fill, height: fill, gap: 22, justify: "center" },
          [
            laneTitle("BEFORE", C.red),
            node("Chart tab", "Price action is visible but has no narrative context.", C.red),
            node("News tab", "Headlines are noisy, unstructured, and hard to quantify.", C.red),
            node("Manual bias", "Trader mentally combines momentum, news tone, and confidence.", C.red),
          ],
        ),
        column(
          { width: fill, height: fill, justify: "center", align: "center" },
          [
            arrow("->", 76),
            mono("fuse", { width: fill, size: 16, color: C.dim, align: "center" }),
          ],
        ),
        column(
          { width: fill, height: fill, gap: 22, justify: "center" },
          [
            laneTitle("AFTER", C.green),
            node("Unified trading surface", "Chart, gauge, news, trend, metrics, alert, and signal together.", C.green),
            node("Quantified narrative", "Headline stream becomes sentiment score, label, and aggregate trend.", C.green),
            node("Auditable bias", "Signal exposes rule score, confidence, and the reasons behind the call.", C.green),
          ],
        ),
      ],
    ),
  );
}

function slide4() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    4,
    "Signal Journey",
    "The user experience follows a single path: select an asset, request intelligence, receive a live signal, inspect the evidence.",
    column(
      { width: fill, height: fill, justify: "center", gap: 34 },
      [
        column(
          { width: fill, height: hug, gap: 18 },
          [
            row(
              { width: fill, height: hug, gap: 24, align: "center", justify: "center" },
              [
                node("1. Select", "asset + range", C.cyan, { width: fixed(386) }),
                arrow("->", 54),
                node("2. Fetch", "REST snapshot", C.green, { width: fixed(386) }),
                arrow("->", 54),
                node("3. Score", "headline NLP", C.yellow, { width: fixed(386) }),
              ],
            ),
            row(
              { width: fill, height: hug, justify: "center" },
              [mono("v", { width: fixed(54), size: 26, bold: true, color: C.dim, align: "center" })],
            ),
            row(
              { width: fill, height: hug, gap: 24, align: "center", justify: "center" },
              [
                node("4. Compare", "sentiment vs price", C.violet, { width: fixed(386) }),
                arrow("->", 54),
                node("5. Infer", "BUY / SELL / HOLD", C.red, { width: fixed(386) }),
                arrow("->", 54),
                node("6. Explain", "confidence + reasons", C.green, { width: fixed(386) }),
              ],
            ),
          ],
        ),
        panel(
          {
            width: fill,
            height: hug,
            fill: "#081018",
            line: { fill: C.line, width: 1 },
            borderRadius: "rounded-lg",
            padding: { x: 34, y: 28 },
          },
          row(
            { width: fill, height: hug, align: "center", justify: "between" },
            [
              display("Core demo line", { width: fixed(320), size: 40, color: C.green }),
              tx(
                "SentiTrade does not hide behind a black box; every signal is backed by visible headline mix, sentiment momentum, price move, and correlation regime.",
                { size: 30, color: C.text, lineSpacing: 1.12 },
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

function slide5() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    5,
    "Architecture Flowchart",
    "A React client speaks to an Express API and a Socket.io channel; backend services fan out to NLP, persistence, price data, and signal inference.",
    column(
      { width: fill, height: fill, gap: 26, justify: "center" },
      [
        row(
          { width: fill, height: hug, gap: 16, align: "center" },
          [
            node("User Browser", "asset/range controls", C.cyan),
            arrow(),
            node("React Dashboard", "Trading surface", C.cyan),
            arrow(),
            node("Express REST API", "/api/sentiment, /trend, /correlation", C.green),
            arrow(),
            node("Socket.io Server", "sentiment:update", C.green),
          ],
        ),
        grid(
          {
            width: fill,
            height: hug,
            columns: [fr(1), fr(1), fr(1), fr(1)],
            columnGap: 18,
            rowGap: 18,
          },
          [
            node("News Service", "NewsAPI fetch + fallback", C.green),
            node("Sentiment Service", "VADER analyzer", C.green),
            node("Trend Service", "Mongo minute buckets", C.yellow),
            node("Correlation Service", "delta sentiment vs delta price", C.violet),
            node("Price Service", "CoinGecko or mock series", C.cyan),
            node("Signal Service", "rule score + reasons", C.red),
            node("Summary Service", "heuristic market summary", C.yellow),
            node("Socket Service", "30s snapshot loop", C.green),
          ],
        ),
        row(
          { width: fill, height: hug, gap: 18, align: "stretch" },
          [
            node("MongoDB Atlas", "NewsSentiment persistence + unique index", C.green),
            node("NewsAPI", "financial headline source", C.cyan),
            node("CoinGecko", "optional crypto price correlation", C.yellow),
            node("Mock Data Service", "demo stability when keys/APIs fail", C.red),
          ],
        ),
      ],
    ),
  );
}

function sequence(label, detail, color) {
  return column(
    { width: fill, height: hug, gap: 8 },
    [
      node(label, detail, color, { labelSize: 22, subSize: 16 }),
      rule({ width: fill, stroke: color, weight: 2 }),
    ],
  );
}

function slide6() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    6,
    "Backend Request Sequence",
    "The `/api/sentiment?asset=BTC&range=1h` path builds a complete intelligence snapshot before the UI renders.",
    column(
      { width: fill, height: fill, justify: "center", gap: 30 },
      [
        grid(
          { width: fill, height: hug, columns: [fr(1), fr(1), fr(1), fr(1)], columnGap: 16, rowGap: 18 },
          [
            sequence("React UI", "GET /api/sentiment", C.cyan),
            sequence("Express API", "controller orchestration", C.green),
            sequence("News Service", "fetch latest headlines", C.green),
            sequence("VADER", "compound score + label", C.yellow),
            sequence("MongoDB", "upsert headline sentiment", C.green),
            sequence("Correlation", "read trend + price series", C.violet),
            sequence("Signal", "score -> BUY / SELL / HOLD", C.red),
            sequence("Response", "news, score, signal, summary", C.cyan),
          ],
        ),
        panel(
          {
            width: fill,
            height: hug,
            fill: "#081018",
            line: { fill: C.line, width: 1 },
            borderRadius: "rounded-lg",
            padding: { x: 34, y: 26 },
          },
          row(
            { width: fill, height: hug, gap: 26, align: "start" },
            [
              mono("Promise.all", { width: fixed(230), size: 28, bold: true, color: C.green }),
              tx(
                "Dashboard loading runs sentiment, trend, and correlation requests in parallel; backend correlation also resolves sentiment trend and price series concurrently.",
                { size: 27, color: C.muted, lineSpacing: 1.13 },
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

function slide7() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    7,
    "Realtime Socket Loop",
    "The realtime path keeps the UI alive after the first REST snapshot.",
    grid(
      { width: fill, height: fill, columns: [fr(1.08), fr(0.92)], columnGap: 54 },
      [
        column(
          { width: fill, height: fill, justify: "center", gap: 20 },
          [
            node("Socket connects", "client opens a stable Socket.io connection", C.cyan),
            arrow("|", 24),
            node("asset:change", "{ asset, range } emitted on selection change", C.green),
            arrow("|", 24),
            node("emitSnapshot()", "latest sentiment + correlation + generated signal", C.yellow),
            arrow("|", 24),
            node("sentiment:update", "UI updates gauge, news, trend, metrics, insight", C.red),
            arrow("|", 24),
            node("30 second interval", "same state, refreshed market snapshot", C.violet),
          ],
        ),
        panel(
          {
            width: fill,
            height: fill,
            fill: "#081018",
            line: { fill: C.line, width: 1 },
            borderRadius: "rounded-lg",
            padding: { x: 34, y: 30 },
          },
          column(
            { width: fill, height: fill, gap: 22 },
            [
              display("Event contract", { size: 44, color: C.green }),
              mono('socket.emit("asset:change", {', { size: 23, color: C.text }),
              mono('  asset: "BTC",', { size: 23, color: C.cyan }),
              mono('  range: "1h"', { size: 23, color: C.yellow }),
              mono("});", { size: 23, color: C.text }),
              rule({ width: fill, stroke: C.line, weight: 1 }),
              mono('socket.emit("sentiment:update", {', { size: 23, color: C.text }),
              mono("  sentiment,", { size: 23, color: C.green }),
              mono("  correlation", { size: 23, color: C.violet }),
              mono("});", { size: 23, color: C.text }),
            ],
          ),
        ),
      ],
    ),
  );
}

function slide8() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    8,
    "Headline NLP Pipeline",
    "Raw finance headlines are converted into normalized sentiment vectors.",
    column(
      { width: fill, height: fill, gap: 28, justify: "center" },
      [
        row(
          { width: fill, height: hug, gap: 14, align: "center" },
          [
            node("NewsAPI query", "q = assetConfig.query", C.cyan),
            arrow(),
            node("mapArticle()", "title/description -> text", C.green),
            arrow(),
            node("VADER polarity", "compound fixed to 4 decimals", C.yellow),
            arrow(),
            node("label threshold", "positive | neutral | negative", C.red),
            arrow(),
            node("averageSentiment()", "score_avg + score_percent", C.green),
          ],
        ),
        grid(
          { width: fill, height: fill, columns: [fr(0.95), fr(1.05)], columnGap: 46 },
          [
            panel(
              {
                width: fill,
                height: fill,
                fill: "#081018",
                line: { fill: C.line, width: 1 },
                borderRadius: "rounded-lg",
                padding: { x: 30, y: 26 },
              },
              column(
                { width: fill, height: fill, gap: 20 },
                [
                  display("Thresholds", { size: 42, color: C.green }),
                  row(
                    { width: fill, height: hug, justify: "between" },
                    [
                      mono("compound >= 0.05", { width: wrap(380), size: 25, color: C.green }),
                      tx("positive", { width: wrap(220), size: 27, color: C.green, bold: true, align: "right" }),
                    ],
                  ),
                  rule({ width: fill, stroke: C.line, weight: 1 }),
                  row(
                    { width: fill, height: hug, justify: "between" },
                    [
                      mono("-0.05 < compound < 0.05", { width: wrap(470), size: 25, color: C.muted }),
                      tx("neutral", { width: wrap(220), size: 27, color: C.yellow, bold: true, align: "right" }),
                    ],
                  ),
                  rule({ width: fill, stroke: C.line, weight: 1 }),
                  row(
                    { width: fill, height: hug, justify: "between" },
                    [
                      mono("compound <= -0.05", { width: wrap(380), size: 25, color: C.red }),
                      tx("negative", { width: wrap(220), size: 27, color: C.red, bold: true, align: "right" }),
                    ],
                  ),
                ],
              ),
            ),
            column(
              { width: fill, height: fill, gap: 20, justify: "center" },
              [
                display("Normalized record", { size: 42, color: C.cyan }),
                mono("{", { size: 24, color: C.text }),
                mono('  "text": "Bitcoin ETF inflows accelerate",', { size: 24, color: C.text }),
                mono('  "source": "CoinDesk",', { size: 24, color: C.text }),
                mono('  "sentiment_score": 0.3182,', { size: 24, color: C.green }),
                mono('  "sentiment_label": "positive",', { size: 24, color: C.green }),
                mono('  "asset": "BTC",', { size: 24, color: C.cyan }),
                mono('  "timestamp": "2026-04-26T07:00:00.000Z"', { size: 24, color: C.muted }),
                mono("}", { size: 24, color: C.text }),
              ],
            ),
          ],
        ),
      ],
    ),
  );
}

function slide9() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    9,
    "Persistence & Aggregation Pipeline",
    "MongoDB stores event-level sentiment; the trend API emits minute-level sentiment points for Chart.js and metrics.",
    grid(
      { width: fill, height: fill, columns: [fr(0.9), fr(1.1)], columnGap: 48 },
      [
        column(
          { width: fill, height: fill, justify: "center", gap: 20 },
          [
            node("findOneAndUpdate()", "{ text, asset } as uniqueness constraint", C.green),
            node("$setOnInsert", "prevents duplicate NewsAPI pulls from bloating the DB", C.yellow),
            node("$match", "asset + timestamp >= selected range", C.cyan),
            node("$group", "minute bucket + avg sentiment_score + count", C.violet),
            node("$project", "sentiment_percent = round(((avg + 1) / 2) * 100)", C.red),
          ],
        ),
        panel(
          {
            width: fill,
            height: fill,
            fill: C.white,
            line: { fill: "#D8E2EA", width: 1 },
            borderRadius: "rounded-lg",
            padding: { x: 24, y: 22 },
          },
          column(
            { width: fill, height: fill, gap: 10 },
            [
              display("Trend object", { size: 36, color: "#111C24" }),
              chart({
                name: "trend-chart",
                chartType: "line",
                width: fill,
                height: fill,
                config: {
                  title: "Sentiment percent over selected window",
                  categories: ["T-5", "T-4", "T-3", "T-2", "T-1", "Now"],
                  series: [
                    { name: "BTC sentiment_percent", values: [51, 55, 61, 58, 66, 63] },
                    { name: "Price move index", values: [48, 50, 54, 57, 56, 61] },
                  ],
                },
              }),
            ],
          ),
        ),
      ],
    ),
  );
}

function slide10() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    10,
    "Correlation Engine",
    "The system compares sentiment momentum with price movement over the same selected range.",
    column(
      { width: fill, height: fill, gap: 30, justify: "center" },
      [
        grid(
          { width: fill, height: hug, columns: [fr(1), fr(1)], columnGap: 30 },
          [
            column(
              { width: fill, height: hug, gap: 16 },
              [
                laneTitle("SENTIMENT RAIL", C.green),
                node("getSentimentTrend(asset, range)", "points[] from Mongo aggregation or mock trend", C.green),
                node("sentiment_change", "toPercent(lastAvg) - toPercent(firstAvg)", C.green),
              ],
            ),
            column(
              { width: fill, height: hug, gap: 16 },
              [
                laneTitle("PRICE RAIL", C.cyan),
                node("getPriceChange(asset, range)", "CoinGecko when enabled, otherwise mock series", C.cyan),
                node("price_change", "((last - first) / first) * 100", C.cyan),
              ],
            ),
          ],
        ),
        panel(
          {
            width: fill,
            height: hug,
            fill: "#081018",
            line: { fill: C.line, width: 1 },
            borderRadius: "rounded-lg",
            padding: { x: 36, y: 28 },
          },
          column(
            { width: fill, height: hug, gap: 16 },
            [
              display("Comparator", { size: 42, color: C.yellow }),
              mono("aligned = abs(sentiment_change) >= 2 && abs(price_change) >= 0.15 && sameDirection", {
                size: 24,
                color: C.text,
              }),
              mono("opposed = thresholds met && direction differs", { size: 24, color: C.muted }),
            ],
          ),
        ),
        row(
          { width: fill, height: hug, gap: 18 },
          [
            node("Positive correlation", "sentiment and price moving together", C.green),
            node("Negative correlation", "sentiment and price diverging", C.red),
            node("Sideways regime", "both signals flat or low conviction", C.yellow),
          ],
        ),
      ],
    ),
  );
}

function slide11() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    11,
    "Signal Inference Pipeline",
    "The rule engine turns visible evidence into an educational signal and confidence score.",
    grid(
      { width: fill, height: fill, columns: [fr(1.05), fr(0.95)], columnGap: 50 },
      [
        column(
          { width: fill, height: fill, justify: "center", gap: 18 },
          [
            node("Sentiment percent", ">=62 adds +2, <=38 adds -2", C.green),
            node("Headline mix", "positiveRatio and negativeRatio shape conviction", C.cyan),
            node("Momentum", "sentiment_change >= 8 adds +2, <= -8 adds -2", C.yellow),
            node("Price movement", "price_change >= 0.75 adds +1, <= -0.75 adds -1", C.violet),
            node("Correlation", "aligned bullish adds +2, aligned bearish adds -2", C.red),
          ],
        ),
        column(
          { width: fill, height: fill, justify: "center", gap: 26 },
          [
            panel(
              {
                width: fill,
                height: hug,
                fill: "#081018",
                line: { fill: C.line, width: 1 },
                borderRadius: "rounded-lg",
                padding: { x: 34, y: 30 },
              },
              column(
                { width: fill, height: hug, gap: 18 },
                [
                  display("Decision bands", { size: 42, color: C.green }),
                  row(
                    { width: fill, height: fixed(28), gap: 0 },
                    [
                      shape({ width: grow(1), height: fixed(24), fill: C.red }),
                      shape({ width: grow(2.2), height: fixed(24), fill: C.yellow }),
                      shape({ width: grow(1), height: fixed(24), fill: C.green }),
                    ],
                  ),
                  row(
                    { width: fill, height: hug, justify: "between" },
                    [
                      mono("SELL <= -4", { width: wrap(250), size: 22, bold: true, color: C.red }),
                      mono("HOLD -3..3", { width: wrap(260), size: 22, bold: true, color: C.yellow, align: "center" }),
                      mono("BUY >= 4", { width: wrap(230), size: 22, bold: true, color: C.green, align: "right" }),
                    ],
                  ),
                ],
              ),
            ),
            tx(
              "Confidence = clamp(45..92, 45 + abs(score)*7 + headlineVolume*0.6 - conflictPenalty). Reasons are capped to the top four human-readable explanations.",
              { size: 27, color: C.muted, lineSpacing: 1.15 },
            ),
          ],
        ),
      ],
    ),
  );
}

function slide12() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    12,
    "Dashboard Experience",
    "The UI behaves like a compact trading desk: dense enough for repeated use, still legible enough for a demo.",
    grid(
      { width: fill, height: fill, columns: [fr(1.35), fr(0.65)], rows: [fr(1), fr(0.38)], columnGap: 18, rowGap: 18 },
      [
        panel(
          {
            width: fill,
            height: fill,
            fill: "#071017",
            line: { fill: C.cyan, width: 1.2 },
            borderRadius: "rounded-lg",
            padding: { x: 22, y: 20 },
          },
          column(
            { width: fill, height: fill, gap: 12 },
            [
              row(
                { width: fill, height: hug, justify: "between" },
                [
                  tx("TradingView chart", { width: wrap(460), size: 26, bold: true, color: C.cyan }),
                  mono("BTC / ETH / AAPL", { width: wrap(320), size: 14, color: C.dim, align: "right" }),
                ],
              ),
              shape({ width: fill, height: fill, fill: "linear(180deg, #0D1821 0%, #081018 100%)", line: { fill: C.line, width: 1 } }),
            ],
          ),
        ),
        column(
          { width: fill, height: fill, gap: 18 },
          [
            node("Sentiment Gauge", "asset pulse + label", C.green, { height: fill }),
            node("Correlation Box", "insight + summary", C.yellow, { height: fill }),
            node("Live News Feed", "scored headlines", C.cyan, { height: fill }),
          ],
        ),
        panel(
          {
            width: fill,
            height: fill,
            fill: "#071017",
            line: { fill: C.green, width: 1.2 },
            borderRadius: "rounded-lg",
            padding: { x: 22, y: 18 },
          },
          row(
            { width: fill, height: fill, gap: 20, align: "center" },
            [
              tx("Sentiment Trend", { width: fixed(280), size: 26, bold: true, color: C.green }),
              shape({ width: fill, height: fixed(92), fill: "#0B1B14", line: { fill: C.line, width: 1 } }),
            ],
          ),
        ),
        panel(
          {
            width: fill,
            height: fill,
            fill: "#071017",
            line: { fill: C.red, width: 1.2 },
            borderRadius: "rounded-lg",
            padding: { x: 22, y: 18 },
          },
          column(
            { width: fill, height: fill, justify: "center", gap: 12 },
            [
              tx("Market Snapshot", { size: 26, bold: true, color: C.red }),
              tx("News volume | Positive ratio | Sentiment move | Price move | Headline mix | Signal reasons", {
                size: 18,
                color: C.muted,
                lineSpacing: 1.14,
              }),
            ],
          ),
        ),
      ],
    ),
  );
}

function slide13() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    13,
    "API Surface",
    "The system exposes a small, demo-friendly API with clear asset/range parameters.",
    grid(
      { width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 44 },
      [
        column(
          { width: fill, height: fill, justify: "center", gap: 18 },
          [
            node("GET /api/assets", "supported assets: BTC, ETH, AAPL", C.cyan),
            node("GET /api/sentiment", "average score, label, headlines, signal, summary", C.green),
            node("GET /api/sentiment/trend", "5m, 1h, 24h trend points", C.yellow),
            node("GET /api/correlation", "sentiment_change, price_change, current_price, insight, signal", C.violet),
            node("GET /api/health", "deployment smoke-test endpoint", C.red),
          ],
        ),
        panel(
          {
            width: fill,
            height: fill,
            fill: "#081018",
            line: { fill: C.line, width: 1 },
            borderRadius: "rounded-lg",
            padding: { x: 34, y: 30 },
          },
          column(
            { width: fill, height: fill, gap: 18 },
            [
              display("Response contract", { size: 42, color: C.green }),
              mono("GET /api/correlation?asset=BTC&range=1h", { size: 23, color: C.cyan }),
              rule({ width: fill, stroke: C.line, weight: 1 }),
              mono("{", { size: 23, color: C.text }),
              mono('  "asset": "BTC",', { size: 23, color: C.text }),
              mono('  "sentiment_change": 20,', { size: 23, color: C.green }),
              mono('  "price_change": 2.5,', { size: 23, color: C.cyan }),
              mono('  "insight": "Positive correlation detected",', { size: 23, color: C.yellow }),
              mono('  "signal": { "signal": "BUY", "confidence": 77 }', { size: 23, color: C.red }),
              mono("}", { size: 23, color: C.text }),
            ],
          ),
        ),
      ],
    ),
  );
}

function slide14() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    14,
    "Deployment & Hardening",
    "The deployment story is intentionally practical: separate frontend/backend, explicit env config, and stable demo fallbacks.",
    column(
      { width: fill, height: fill, gap: 26, justify: "center" },
      [
        row(
          { width: fill, height: hug, gap: 16, align: "center" },
          [
            node("Vercel", "frontend/static Vite app", C.cyan),
            arrow(),
            node("Render API", "Node/Express web service", C.green),
            arrow(),
            node("MongoDB Atlas", "managed persistence", C.yellow),
            arrow(),
            node("External APIs", "NewsAPI + CoinGecko", C.red),
          ],
        ),
        grid(
          { width: fill, height: hug, columns: [fr(1), fr(1), fr(1)], columnGap: 18, rowGap: 18 },
          [
            node("CORS allowlist", "CLIENT_URL / FRONTEND_URL controls browser access", C.cyan),
            node("Socket CORS", "same origin policy for realtime channel", C.cyan),
            node("helmet", "security headers", C.green),
            node("compression", "lighter API responses", C.green),
            node("express-rate-limit", "default 120 requests/min on /api", C.yellow),
            node("graceful shutdown", "SIGTERM / SIGINT closes HTTP server", C.violet),
            node("env-driven config", "VITE_API_URL, VITE_SOCKET_URL, MONGODB_URI, NEWS_API_KEY", C.red),
            node("mock fallback", "usable when MongoDB or NewsAPI are absent", C.green),
            node("price opt-in", "ENABLE_LIVE_PRICE_API avoids CoinGecko noise during demos", C.yellow),
          ],
        ),
      ],
    ),
  );
}

function slide15() {
  const slide = presentation.slides.add();
  slideChrome(
    slide,
    15,
    "Evaluation & Next Iteration",
    "The BTP value is the complete, explainable pipeline. The upgrade path is domain-specific modeling and quantitative validation.",
    grid(
      { width: fill, height: fill, columns: [fr(1), fr(1)], rows: [fr(1), auto], columnGap: 48, rowGap: 28 },
      [
        column(
          { width: fill, height: fill, gap: 22 },
          [
            laneTitle("IMPLEMENTED", C.green),
            bullet("End-to-end intelligence path", "News ingestion -> NLP scoring -> Mongo persistence -> trend aggregation -> UI visualization.", C.green),
            bullet("Transparent signal layer", "Rule score, confidence, reasons[], and disclaimer make the system viva-friendly.", C.cyan),
            bullet("Realtime dashboard behavior", "Socket.io keeps sentiment, correlation, trend, and metrics fresh.", C.yellow),
            bullet("Demo resilience", "Mock news and price paths avoid API-key or rate-limit failures during presentation.", C.violet),
          ],
        ),
        column(
          { width: fill, height: fill, gap: 22 },
          [
            laneTitle("FUTURE SCOPE", C.cyan),
            bullet("FinBERT-style sentiment model", "Replace generic VADER with finance-domain transformer sentiment.", C.green),
            bullet("Backtesting module", "Replay historical news and price windows to evaluate signal behavior.", C.yellow),
            bullet("Risk engine", "Add volatility, drawdown, exposure, and position-sizing constraints.", C.red),
            bullet("Broker sandbox", "Simulate order execution while preserving educational boundaries.", C.violet),
          ],
        ),
        panel(
          {
            columnSpan: 2,
            width: fill,
            height: hug,
            fill: "#081018",
            line: { fill: C.green, width: 1.2 },
            borderRadius: "rounded-lg",
            padding: { x: 36, y: 24 },
          },
          tx(
            "Final thesis: SentiTrade is an explainable market-sentiment intelligence layer that converts fragmented trading context into a realtime, auditable decision-support signal.",
            { size: 31, color: C.text, lineSpacing: 1.12 },
          ),
        ),
      ],
    ),
  );
}

async function writeBlob(filePath, blob) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (blob?.data) {
    await fs.writeFile(filePath, Buffer.from(blob.data));
    return;
  }
  if (typeof blob?.arrayBuffer === "function") {
    await fs.writeFile(filePath, Buffer.from(await blob.arrayBuffer()));
    return;
  }
  if (typeof blob?.bytes === "function") {
    await fs.writeFile(filePath, Buffer.from(await blob.bytes()));
    return;
  }
  throw new Error(`Unsupported blob type for ${filePath}`);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });

  [
    slide1,
    slide2,
    slide3,
    slide4,
    slide5,
    slide6,
    slide7,
    slide8,
    slide9,
    slide10,
    slide11,
    slide12,
    slide13,
    slide14,
    slide15,
  ].forEach((fn) => fn());

  const pptx = await PresentationFile.exportPptx(presentation);
  await writeBlob(PPTX_PATH, pptx);

  const previews = [];
  for (let i = 0; i < presentation.slides.count; i += 1) {
    const slide = presentation.slides.getItem(i);
    const png = await slide.export({ format: "png" });
    const previewPath = path.join(PREVIEW_DIR, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await writeBlob(previewPath, png);
    previews.push(previewPath);
  }

  await fs.writeFile(
    path.join(SCRATCH_DIR, "deck-build.json"),
    JSON.stringify({ pptx: PPTX_PATH, slideCount: presentation.slides.count, previews }, null, 2),
    "utf8",
  );

  console.log(JSON.stringify({ pptx: PPTX_PATH, slideCount: presentation.slides.count, previews }, null, 2));
}

await main();
