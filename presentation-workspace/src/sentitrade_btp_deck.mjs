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
  wrap,
  grow,
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
  bg: "#070A0E",
  bg2: "#0B1117",
  ink: "#EAF2F8",
  muted: "#8EA4B8",
  muted2: "#536779",
  line: "#243241",
  panel: "#101820",
  panel2: "#0D141B",
  green: "#45FFB3",
  cyan: "#4CC9F0",
  amber: "#FFD166",
  red: "#FF4D6D",
  violet: "#B388FF",
  white: "#FFFFFF",
  black: "#05070A",
};

const F = {
  display: "DIN Condensed",
  body: "Avenir Next",
  mono: "Menlo",
};

const presentation = Presentation.create({
  slideSize: { width: W, height: H },
});

function t(value, options = {}) {
  return text(value, {
    width: options.width ?? fill,
    height: options.height ?? hug,
    columnSpan: options.columnSpan,
    rowSpan: options.rowSpan,
    name: options.name,
    style: {
      typeface: options.typeface ?? F.body,
      fontSize: options.size ?? 32,
      color: options.color ?? C.ink,
      bold: options.bold ?? false,
      italic: options.italic ?? false,
      alignment: options.alignment,
      lineSpacing: options.lineSpacing ?? 1.08,
      wrap: options.wrap,
    },
  });
}

function title(textValue, subtitleValue, num) {
  return row(
    { width: fill, height: hug, align: "start", gap: 28 },
    [
      column(
        { width: fixed(96), height: hug, gap: 8, padding: { top: 10 } },
        [
          t(String(num).padStart(2, "0"), {
            width: fixed(96),
            size: 34,
            typeface: F.mono,
            bold: true,
            color: C.green,
          }),
          rule({ width: fixed(70), stroke: C.green, weight: 4 }),
        ],
      ),
      column(
        { width: fill, height: hug, gap: 10 },
        [
          t(textValue, {
            name: "slide-title",
            size: 64,
            typeface: F.display,
            bold: true,
            color: C.ink,
            lineSpacing: 0.95,
          }),
          subtitleValue
            ? t(subtitleValue, {
                name: "subtitle",
                width: wrap(1280),
                size: 25,
                color: C.muted,
                lineSpacing: 1.08,
              })
            : null,
        ].filter(Boolean),
      ),
    ],
  );
}

function deckFrame(slide, num, titleText, subtitleText, content, opts = {}) {
  const root = layers(
    { width: fill, height: fill },
    [
      shape({
        name: "background",
        width: fill,
        height: fill,
        fill:
          opts.cover === true
            ? "linear(130deg, #070A0E 0%, #0A1821 48%, #061812 100%)"
            : C.bg,
      }),
      column(
        {
          name: "content-root",
          width: fill,
          height: fill,
          padding: { x: 84, y: 62 },
          gap: opts.gap ?? 42,
        },
        [
          opts.noTitle ? null : title(titleText, subtitleText, num),
          content,
          row(
            { width: fill, height: hug, align: "center", justify: "between" },
            [
              t("SentiTrade BTP Project", {
                width: wrap(620),
                size: 16,
                color: C.muted2,
                typeface: F.mono,
              }),
              t("Educational decision-support signal, not financial advice", {
                width: wrap(760),
                size: 16,
                color: C.muted2,
                typeface: F.mono,
                alignment: "right",
              }),
            ],
          ),
        ].filter(Boolean),
      ),
    ],
  );
  slide.compose(root, {
    frame: { left: 0, top: 0, width: W, height: H },
    baseUnit: 8,
  });
}

function bullet(textValue, accent = C.green, detail) {
  return row(
    { width: fill, height: hug, gap: 18, align: "start" },
    [
      shape({
        width: fixed(12),
        height: fixed(12),
        fill: accent,
        borderRadius: "rounded-full",
      }),
      column(
        { width: fill, height: hug, gap: 6 },
        [
          t(textValue, { size: 29, bold: true, color: C.ink, lineSpacing: 1.06 }),
          detail
            ? t(detail, { size: 21, color: C.muted, lineSpacing: 1.12 })
            : null,
        ].filter(Boolean),
      ),
    ],
  );
}

function nodeBox(label, sub, accent = C.green, opts = {}) {
  return panel(
    {
      name: opts.name,
      width: opts.width ?? fill,
      height: opts.height ?? hug,
      fill: opts.fill ?? C.panel,
      line: { fill: accent, width: 1.4 },
      borderRadius: "rounded-lg",
      padding: { x: 24, y: 20 },
    },
    column(
      { width: fill, height: hug, gap: 8 },
      [
        t(label, {
          size: opts.labelSize ?? 26,
          bold: true,
          color: opts.labelColor ?? C.ink,
          lineSpacing: 1,
        }),
        sub
          ? t(sub, {
              size: opts.subSize ?? 18,
              color: opts.subColor ?? C.muted,
              lineSpacing: 1.12,
            })
          : null,
      ].filter(Boolean),
    ),
  );
}

function codeLine(value, color = C.green) {
  return t(value, {
    size: 22,
    color,
    typeface: F.mono,
    lineSpacing: 1.12,
  });
}

function smallTag(value, color = C.green) {
  return panel(
    {
      width: hug,
      height: hug,
      fill: "#0B1218",
      line: { fill: color, width: 1 },
      borderRadius: "rounded-full",
      padding: { x: 18, y: 8 },
    },
    t(value, {
      width: hug,
      size: 18,
      bold: true,
      color,
      typeface: F.mono,
      wrap: "none",
    }),
  );
}

function slide1() {
  const slide = presentation.slides.add();
  const content = layers(
    { width: fill, height: fill },
    [
      shape({
        width: fill,
        height: fill,
        fill: "linear(120deg, #070A0E 0%, #0B1720 50%, #061D16 100%)",
      }),
      column(
        { width: fill, height: fill, padding: { x: 92, y: 72 }, gap: 48, justify: "between" },
        [
          row(
            { width: fill, height: hug, justify: "between", align: "center" },
            [
              t("BTP PROJECT DEFENSE", {
                width: wrap(520),
                size: 22,
                typeface: F.mono,
                bold: true,
                color: C.green,
              }),
              t("Real-Time Market Sentiment Intelligence", {
                width: wrap(680),
                size: 20,
                typeface: F.mono,
                color: C.muted,
                alignment: "right",
              }),
            ],
          ),
          column(
            { width: fill, height: hug, gap: 20 },
            [
              t("SentiTrade", {
                name: "cover-title",
                width: wrap(1180),
                size: 148,
                typeface: F.display,
                bold: true,
                color: C.ink,
                lineSpacing: 0.86,
              }),
              rule({ width: fixed(360), stroke: C.green, weight: 6 }),
              t(
                "A real-time dashboard that fuses price action, headline sentiment, correlation analytics, and transparent BUY / SELL / HOLD signal generation.",
                {
                  width: wrap(1260),
                  size: 32,
                  color: C.muted,
                  lineSpacing: 1.14,
                },
              ),
            ],
          ),
          row(
            { width: fill, height: hug, align: "center", gap: 20 },
            [
              smallTag("PRICE ACTION", C.cyan),
              t("->", { width: hug, size: 24, color: C.muted2, typeface: F.mono }),
              smallTag("NLP SENTIMENT", C.green),
              t("->", { width: hug, size: 24, color: C.muted2, typeface: F.mono }),
              smallTag("CORRELATION ENGINE", C.amber),
              t("->", { width: hug, size: 24, color: C.muted2, typeface: F.mono }),
              smallTag("TRADE SIGNAL", C.red),
            ],
          ),
          row(
            { width: fill, height: hug, justify: "between", align: "end" },
            [
              t("Crypto + Stock Assets: BTC, ETH, AAPL", {
                width: wrap(760),
                size: 20,
                color: C.muted2,
                typeface: F.mono,
              }),
              t("React | Express | MongoDB | Socket.io | VADER", {
                width: wrap(760),
                size: 20,
                color: C.muted2,
                typeface: F.mono,
                alignment: "right",
              }),
            ],
          ),
        ],
      ),
    ],
  );
  slide.compose(content, {
    frame: { left: 0, top: 0, width: W, height: H },
    baseUnit: 8,
  });
}

function slide2() {
  const slide = presentation.slides.add();
  deckFrame(
    slide,
    2,
    "Problem Statement",
    "Retail traders consume price charts and market narratives through disconnected interfaces.",
    grid(
      {
        width: fill,
        height: fill,
        columns: [fr(0.92), fr(1.08)],
        columnGap: 70,
        rows: [fr(1)],
      },
      [
        column(
          { width: fill, height: fill, justify: "center", gap: 30 },
          [
            t("Price action without narrative context is a low-bandwidth signal.", {
              size: 64,
              typeface: F.display,
              bold: true,
              color: C.ink,
              lineSpacing: 0.96,
            }),
            t(
              "The project attacks the information asymmetry between structured market movement and unstructured financial news.",
              {
                size: 28,
                color: C.muted,
                lineSpacing: 1.12,
              },
            ),
          ],
        ),
        column(
          { width: fill, height: fill, justify: "center", gap: 30 },
          [
            bullet(
              "Fragmented decision surface",
              C.cyan,
              "TradingView, headlines, market metrics, and alerts usually live in separate tabs.",
            ),
            bullet(
              "Unstructured news latency",
              C.green,
              "Headlines arrive as text streams, but the trader needs an aggregated sentiment vector.",
            ),
            bullet(
              "No explainable signal layer",
              C.amber,
              "Many tools show indicators, but few expose the rule trace behind BUY / SELL / HOLD.",
            ),
            bullet(
              "Demo stability risk",
              C.red,
              "Live APIs can fail during evaluation, so fallback data is part of the system design.",
            ),
          ],
        ),
      ],
    ),
  );
}

function slide3() {
  const slide = presentation.slides.add();
  deckFrame(
    slide,
    3,
    "Project Objectives",
    "Build an explainable market-intelligence pipeline for real-time sentiment-aware decision support.",
    column(
      { width: fill, height: fill, gap: 36 },
      [
        row(
          { width: fill, height: hug, gap: 22, align: "stretch" },
          [
            nodeBox("Asset coverage", "BTC, ETH, and AAPL as cross-market demo targets.", C.cyan),
            nodeBox("NLP scoring", "VADER compound sentiment on latest NewsAPI headlines.", C.green),
            nodeBox("Time windows", "Trend aggregation for 5m, 1h, and 24h analysis.", C.amber),
          ],
        ),
        row(
          { width: fill, height: hug, gap: 22, align: "stretch" },
          [
            nodeBox("Correlation analytics", "Compare sentiment delta with price delta over the same range.", C.violet),
            nodeBox("Signal inference", "Rule-based BUY / SELL / HOLD engine with confidence and reasons.", C.red),
            nodeBox("Realtime UX", "Socket.io event stream refreshes the market state every 30 seconds.", C.green),
          ],
        ),
        panel(
          {
            width: fill,
            height: hug,
            fill: "#0B1218",
            line: { fill: C.line, width: 1 },
            borderRadius: "rounded-lg",
            padding: { x: 34, y: 26 },
          },
          row(
            { width: fill, height: hug, align: "center", justify: "between", gap: 30 },
            [
              t("Scope boundary", {
                width: fixed(300),
                size: 34,
                typeface: F.display,
                bold: true,
                color: C.green,
              }),
              t(
                "The model is deliberately heuristic and transparent. It is a decision-support dashboard, not an autonomous trading bot or predictive ML alpha model.",
                {
                  size: 26,
                  color: C.muted,
                  lineSpacing: 1.12,
                },
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

function slide4() {
  const slide = presentation.slides.add();
  deckFrame(
    slide,
    4,
    "System Architecture",
    "SentiTrade separates the presentation layer, API layer, service layer, persistence layer, and external data providers.",
    column(
      { width: fill, height: fill, gap: 32, justify: "center" },
      [
        row(
          { width: fill, height: hug, gap: 18, align: "center" },
          [
            nodeBox("User Browser", "React dashboard", C.cyan, { width: fixed(260) }),
            t("->", { width: hug, size: 30, color: C.muted2, typeface: F.mono }),
            nodeBox("Frontend", "Vite + Tailwind + Chart.js + TradingView widget", C.cyan),
            t("->", { width: hug, size: 30, color: C.muted2, typeface: F.mono }),
            nodeBox("Backend API", "Express REST endpoints + Socket.io server", C.green),
          ],
        ),
        rule({ width: fill, stroke: C.line, weight: 1 }),
        grid(
          {
            width: fill,
            height: hug,
            columns: [fr(1), fr(1), fr(1), fr(1)],
            columnGap: 20,
            rowGap: 20,
          },
          [
            nodeBox("News Service", "Fetches latest headlines and normalizes payloads.", C.green),
            nodeBox("Sentiment Service", "Runs VADER scoring and label classification.", C.green),
            nodeBox("Trend Service", "Aggregates sentiment by minute for charting.", C.amber),
            nodeBox("Correlation Service", "Calculates sentiment-change vs price-change.", C.violet),
            nodeBox("Price Service", "CoinGecko crypto prices, mock fallback for stability.", C.cyan),
            nodeBox("Signal Service", "Rule-score inference with confidence and reasons.", C.red),
            nodeBox("Socket Service", "Emits sentiment:update snapshots every 30 seconds.", C.green),
            nodeBox("Summary Service", "Generates AI-style heuristic market summary.", C.amber),
          ],
        ),
        row(
          { width: fill, height: hug, gap: 22, align: "stretch" },
          [
            nodeBox("MongoDB Atlas", "Normalized headline sentiment records with unique text+asset index.", C.green),
            nodeBox("NewsAPI", "External headline source for asset-specific market narratives.", C.cyan),
            nodeBox("Mock Data Layer", "Fault-tolerant offline/demo fallback for judging and local development.", C.amber),
          ],
        ),
      ],
    ),
  );
}

function slide5() {
  const slide = presentation.slides.add();
  deckFrame(
    slide,
    5,
    "NLP Sentiment Pipeline",
    "The pipeline converts unstructured financial headlines into normalized sentiment records and trend points.",
    column(
      { width: fill, height: fill, gap: 34 },
      [
        row(
          { width: fill, height: hug, gap: 16, align: "center" },
          [
            nodeBox("1. Ingest", "NewsAPI asset query", C.cyan),
            t("->", { width: hug, size: 26, color: C.muted2, typeface: F.mono }),
            nodeBox("2. Normalize", "headline, source, asset, timestamp", C.green),
            t("->", { width: hug, size: 26, color: C.muted2, typeface: F.mono }),
            nodeBox("3. Score", "VADER compound in [-1, 1]", C.amber),
            t("->", { width: hug, size: 26, color: C.muted2, typeface: F.mono }),
            nodeBox("4. Persist", "MongoDB upsert", C.violet),
            t("->", { width: hug, size: 26, color: C.muted2, typeface: F.mono }),
            nodeBox("5. Aggregate", "minute-bucket trend", C.red),
          ],
        ),
        grid(
          {
            width: fill,
            height: fill,
            columns: [fr(0.9), fr(1.1)],
            columnGap: 52,
          },
          [
            panel(
              {
                width: fill,
                height: fill,
                fill: "#0B1218",
                line: { fill: C.line, width: 1 },
                borderRadius: "rounded-lg",
                padding: { x: 34, y: 30 },
              },
              column(
                { width: fill, height: fill, gap: 20 },
                [
                  t("VADER classification thresholds", {
                    size: 34,
                    typeface: F.display,
                    bold: true,
                    color: C.ink,
                  }),
                  row(
                    { width: fill, height: hug, justify: "between", align: "center" },
                    [
                      t("compound >= 0.05", { width: wrap(300), size: 26, color: C.green, typeface: F.mono }),
                      t("positive", {
                        width: wrap(280),
                        size: 26,
                        bold: true,
                        color: C.green,
                        alignment: "right",
                        wrap: "none",
                      }),
                    ],
                  ),
                  rule({ width: fill, stroke: C.line, weight: 1 }),
                  row(
                    { width: fill, height: hug, justify: "between", align: "center" },
                    [
                      t("-0.05 < compound < 0.05", { width: wrap(420), size: 26, color: C.muted, typeface: F.mono }),
                      t("neutral", {
                        width: wrap(280),
                        size: 26,
                        bold: true,
                        color: C.amber,
                        alignment: "right",
                        wrap: "none",
                      }),
                    ],
                  ),
                  rule({ width: fill, stroke: C.line, weight: 1 }),
                  row(
                    { width: fill, height: hug, justify: "between", align: "center" },
                    [
                      t("compound <= -0.05", { width: wrap(300), size: 26, color: C.red, typeface: F.mono }),
                      t("negative", {
                        width: wrap(280),
                        size: 26,
                        bold: true,
                        color: C.red,
                        alignment: "right",
                        wrap: "none",
                      }),
                    ],
                  ),
                ],
              ),
            ),
            column(
              { width: fill, height: fill, gap: 22, justify: "center" },
              [
                t("Output contract", {
                  size: 42,
                  typeface: F.display,
                  bold: true,
                  color: C.green,
                }),
                codeLine("{"),
                codeLine('  "text": "Bitcoin spot ETF inflows accelerate",', C.ink),
                codeLine('  "source": "CoinDesk",', C.ink),
                codeLine('  "sentiment_score": 0.3182,', C.green),
                codeLine('  "sentiment_label": "positive",', C.green),
                codeLine('  "asset": "BTC",', C.ink),
                codeLine('  "timestamp": "2026-04-26T07:00:00.000Z"', C.ink),
                codeLine("}"),
              ],
            ),
          ],
        ),
      ],
    ),
  );
}

function slide6() {
  const slide = presentation.slides.add();
  deckFrame(
    slide,
    6,
    "Persistence & Aggregation",
    "MongoDB stores normalized headline events; the trend API converts raw scores into chart-ready sentiment percentages.",
    grid(
      {
        width: fill,
        height: fill,
        columns: [fr(0.82), fr(1.18)],
        columnGap: 50,
      },
      [
        panel(
          {
            width: fill,
            height: fill,
            fill: "#0B1218",
            line: { fill: C.line, width: 1 },
            borderRadius: "rounded-lg",
            padding: { x: 32, y: 30 },
          },
          column(
            { width: fill, height: fill, gap: 18 },
            [
              t("NewsSentiment schema", {
                size: 36,
                typeface: F.display,
                bold: true,
                color: C.ink,
              }),
              codeLine("text: String", C.ink),
              codeLine("source: String", C.ink),
              codeLine("sentiment_score: Number", C.green),
              codeLine("sentiment_label: enum", C.amber),
              codeLine('  "positive" | "neutral" | "negative"', C.amber),
              codeLine("asset: String", C.cyan),
              codeLine("timestamp: Date", C.ink),
              rule({ width: fill, stroke: C.line, weight: 1 }),
              t("Deduplication index", {
                size: 25,
                bold: true,
                color: C.green,
              }),
              codeLine("{ text: 1, asset: 1 }", C.green),
            ],
          ),
        ),
        panel(
          {
            width: fill,
            height: fill,
            fill: C.white,
            line: { fill: "#D5DEE7", width: 1 },
            borderRadius: "rounded-lg",
            padding: { x: 24, y: 24 },
          },
          column(
            { width: fill, height: fill, gap: 16 },
            [
              t("Trend aggregation example", {
                size: 34,
                typeface: F.display,
                bold: true,
                color: "#10202A",
              }),
              chart({
                name: "sentiment-trend-chart",
                chartType: "line",
                width: fill,
                height: fill,
                config: {
                  title: "Sentiment percent over selected window",
                  categories: ["T-5", "T-4", "T-3", "T-2", "T-1", "Now"],
                  series: [
                    {
                      name: "BTC sentiment_percent",
                      values: [52, 56, 60, 58, 64, 63],
                    },
                    {
                      name: "ETH sentiment_percent",
                      values: [49, 50, 54, 57, 55, 59],
                    },
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

function slide7() {
  const slide = presentation.slides.add();
  deckFrame(
    slide,
    7,
    "Correlation Engine",
    "The backend compares sentiment momentum and market movement over the same time window.",
    column(
      { width: fill, height: fill, gap: 40, justify: "center" },
      [
        row(
          { width: fill, height: hug, gap: 24, align: "stretch" },
          [
            nodeBox("Sentiment series", "trend points from MongoDB aggregation", C.green),
            t("->", { width: hug, size: 36, color: C.muted2, typeface: F.mono }),
            nodeBox("Delta sentiment", "last bucket - first bucket", C.green),
            t("+", { width: hug, size: 42, color: C.muted2, typeface: F.mono }),
            nodeBox("Price series", "CoinGecko or stable mock fallback", C.cyan),
            t("->", { width: hug, size: 36, color: C.muted2, typeface: F.mono }),
            nodeBox("Delta price", "current price movement percent", C.cyan),
          ],
        ),
        panel(
          {
            width: fill,
            height: hug,
            fill: "#0B1218",
            line: { fill: C.line, width: 1 },
            borderRadius: "rounded-lg",
            padding: { x: 42, y: 34 },
          },
          column(
            { width: fill, height: hug, gap: 20 },
            [
              t("Comparator logic", {
                size: 46,
                typeface: F.display,
                bold: true,
                color: C.green,
              }),
              t("sign(Delta sentiment) == sign(Delta price) => positive correlation", {
                size: 32,
                typeface: F.mono,
                color: C.ink,
              }),
              t("signs diverge => sentiment-price divergence; both flat => sideways regime", {
                size: 28,
                color: C.muted,
              }),
            ],
          ),
        ),
        row(
          { width: fill, height: hug, gap: 20, align: "stretch" },
          [
            nodeBox("Positive correlation", "Narrative and price action are moving together.", C.green),
            nodeBox("Negative correlation", "Sentiment diverges from price movement.", C.red),
            nodeBox("Sideways regime", "Both signals are near-flat or low conviction.", C.amber),
          ],
        ),
      ],
    ),
  );
}

function slide8() {
  const slide = presentation.slides.add();
  deckFrame(
    slide,
    8,
    "Rule-Based Signal Inference",
    "The signal engine is intentionally transparent: every signal is derived from visible dashboard metrics.",
    grid(
      {
        width: fill,
        height: fill,
        columns: [fr(0.9), fr(1.1)],
        columnGap: 56,
      },
      [
        column(
          { width: fill, height: fill, justify: "center", gap: 26 },
          [
            bullet("Overall sentiment score", C.green, "Normalized score becomes a 0-100% sentiment gauge."),
            bullet("Headline mix ratios", C.cyan, "Positive, neutral, and negative proportions act as evidence distribution."),
            bullet("Momentum vector", C.amber, "Latest trend point is compared against the opening trend point."),
            bullet("Price movement", C.violet, "Backend price delta keeps the signal tied to market structure."),
            bullet("Correlation direction", C.red, "Divergence weakens conviction; alignment improves confidence."),
          ],
        ),
        column(
          { width: fill, height: fill, justify: "center", gap: 30 },
          [
            panel(
              {
                width: fill,
                height: hug,
                fill: "#0B1218",
                line: { fill: C.line, width: 1 },
                borderRadius: "rounded-lg",
                padding: { x: 36, y: 32 },
              },
              column(
                { width: fill, height: hug, gap: 20 },
                [
                  t("Rule score thresholds", {
                    size: 44,
                    typeface: F.display,
                    bold: true,
                    color: C.ink,
                  }),
                  row(
                    { width: fill, height: fixed(82), gap: 0, align: "center" },
                    [
                      shape({ width: grow(1), height: fixed(20), fill: C.red }),
                      shape({ width: grow(1.8), height: fixed(20), fill: C.amber }),
                      shape({ width: grow(1), height: fixed(20), fill: C.green }),
                    ],
                  ),
                  row(
                    { width: fill, height: hug, justify: "between" },
                    [
                      t("SELL <= -4", { width: wrap(240), size: 24, color: C.red, typeface: F.mono, bold: true }),
                      t("HOLD -3..3", { width: wrap(260), size: 24, color: C.amber, typeface: F.mono, bold: true, alignment: "center" }),
                      t("BUY >= 4", { width: wrap(220), size: 24, color: C.green, typeface: F.mono, bold: true, alignment: "right" }),
                    ],
                  ),
                ],
              ),
            ),
            t(
              "Output: signal, tone, confidence, numeric score, reasons[], and disclaimer. This makes the system auditable during viva or demo evaluation.",
              {
                size: 30,
                color: C.muted,
                lineSpacing: 1.14,
              },
            ),
          ],
        ),
      ],
    ),
  );
}

function slide9() {
  const slide = presentation.slides.add();
  deckFrame(
    slide,
    9,
    "Trading Surface",
    "The frontend is a compact single-screen trading dashboard optimized for scanning, comparison, and repeated refresh.",
    grid(
      {
        width: fill,
        height: fill,
        columns: [fr(1.28), fr(0.72)],
        rows: [fr(1), fr(0.42)],
        columnGap: 20,
        rowGap: 20,
      },
      [
        panel(
          {
            width: fill,
            height: fill,
            fill: "#0A1016",
            line: { fill: C.cyan, width: 1.2 },
            borderRadius: "rounded-lg",
            padding: { x: 26, y: 24 },
          },
          column(
            { width: fill, height: fill, gap: 16 },
            [
              row(
                { width: fill, height: hug, justify: "between", align: "center" },
                [
                  t("TradingView Chart", { width: wrap(420), size: 32, typeface: F.display, bold: true, color: C.cyan }),
                  t("BTC / ETH / AAPL", { width: wrap(340), size: 20, typeface: F.mono, color: C.muted, alignment: "right" }),
                ],
              ),
              shape({ width: fill, height: grow(1), fill: "linear(180deg, #0E1722 0%, #081018 100%)", line: { fill: C.line, width: 1 } }),
            ],
          ),
        ),
        column(
          { width: fill, height: fill, gap: 20 },
          [
            nodeBox("Sentiment Gauge", "current sentiment percent and label", C.green, { height: grow(1) }),
            nodeBox("Correlation Insight", "alignment or divergence explanation", C.amber, { height: grow(1) }),
            nodeBox("Live News Feed", "latest scored headlines with labels", C.cyan, { height: grow(1) }),
          ],
        ),
        panel(
          {
            width: fill,
            height: fill,
            fill: "#0A1016",
            line: { fill: C.green, width: 1.2 },
            borderRadius: "rounded-lg",
            padding: { x: 24, y: 20 },
          },
          row(
            { width: fill, height: fill, gap: 22, align: "center" },
            [
              t("Sentiment Trend", { width: fixed(300), size: 32, typeface: F.display, bold: true, color: C.green }),
              shape({ width: fill, height: fixed(110), fill: "#111D16", line: { fill: C.line, width: 1 } }),
            ],
          ),
        ),
        panel(
          {
            width: fill,
            height: fill,
            fill: "#0A1016",
            line: { fill: C.red, width: 1.2 },
            borderRadius: "rounded-lg",
            padding: { x: 24, y: 20 },
          },
          column(
            { width: fill, height: fill, gap: 14, justify: "center" },
            [
              t("Market Metrics", { size: 32, typeface: F.display, bold: true, color: C.red }),
              t("News volume | Positive ratio | Sentiment move | Price move | Trade signal", {
                size: 21,
                color: C.muted,
                lineSpacing: 1.14,
              }),
              t('Socket event: "sentiment:update" every 30s', {
                size: 19,
                typeface: F.mono,
                color: C.green,
              }),
            ],
          ),
        ),
      ],
    ),
  );
}

function stackRow(layer, tech, purpose, accent) {
  return row(
    { width: fill, height: hug, gap: 20, align: "center" },
    [
      t(layer, { width: fixed(260), size: 24, bold: true, color: accent }),
      t(tech, { width: fixed(560), size: 23, color: C.ink }),
      t(purpose, { width: fill, size: 21, color: C.muted, lineSpacing: 1.1 }),
    ],
  );
}

function slide10() {
  const slide = presentation.slides.add();
  deckFrame(
    slide,
    10,
    "Technology Stack",
    "The implementation uses a modern MERN-style architecture with event streaming and external market/news APIs.",
    column(
      { width: fill, height: fill, gap: 24 },
      [
        panel(
          {
            width: fill,
            height: hug,
            fill: "#0B1218",
            line: { fill: C.line, width: 1 },
            borderRadius: "rounded-lg",
            padding: { x: 32, y: 28 },
          },
          column(
            { width: fill, height: hug, gap: 18 },
            [
              stackRow("Frontend", "React, Vite, JSX, Tailwind CSS", "Single-page fintech dashboard with responsive controls.", C.cyan),
              rule({ width: fill, stroke: C.line, weight: 1 }),
              stackRow("Visualization", "TradingView, Chart.js", "Live price UI plus sentiment trend rendering.", C.green),
              rule({ width: fill, stroke: C.line, weight: 1 }),
              stackRow("Backend", "Node.js, Express", "REST controllers, service orchestration, API hardening.", C.amber),
              rule({ width: fill, stroke: C.line, weight: 1 }),
              stackRow("Realtime", "Socket.io", "Pushes refreshed sentiment and correlation snapshots.", C.violet),
              rule({ width: fill, stroke: C.line, weight: 1 }),
              stackRow("Data Layer", "MongoDB Atlas, Mongoose", "Normalized sentiment persistence and duplicate prevention.", C.green),
              rule({ width: fill, stroke: C.line, weight: 1 }),
              stackRow("External APIs", "NewsAPI, CoinGecko", "Headline ingestion and crypto price correlation data.", C.red),
              rule({ width: fill, stroke: C.line, weight: 1 }),
              stackRow("Deployment", "Render, Vercel", "Separate backend/frontend deployment with env-based CORS allowlist.", C.cyan),
            ],
          ),
        ),
        row(
          { width: fill, height: hug, justify: "between", gap: 28 },
          [
            smallTag("helmet + rate-limit", C.amber),
            smallTag("compression", C.cyan),
            smallTag("mock fallback", C.green),
            smallTag("graceful shutdown", C.violet),
            smallTag("env-driven config", C.red),
          ],
        ),
      ],
    ),
  );
}

function slide11() {
  const slide = presentation.slides.add();
  deckFrame(
    slide,
    11,
    "Evaluation & Future Scope",
    "SentiTrade proves a complete real-time sentiment intelligence workflow while leaving clear upgrade paths.",
    grid(
      {
        width: fill,
        height: fill,
        columns: [fr(1), fr(1)],
        rows: [fr(1), auto],
        columnGap: 50,
        rowGap: 34,
      },
      [
        column(
          { width: fill, height: fill, gap: 26 },
          [
            t("Implemented outcomes", {
              size: 44,
              typeface: F.display,
              bold: true,
              color: C.green,
            }),
            bullet("End-to-end data path", C.green, "News ingestion -> NLP scoring -> persistence -> aggregation -> UI visualization."),
            bullet("Explainable inference", C.cyan, "Signal reasons expose the heuristic decision trace."),
            bullet("Realtime refresh", C.amber, "Socket.io maintains a live dashboard without manual polling UX."),
            bullet("Demo resilience", C.violet, "Mock data path keeps the project presentable without API keys."),
          ],
        ),
        column(
          { width: fill, height: fill, gap: 26 },
          [
            t("Future scope", {
              size: 44,
              typeface: F.display,
              bold: true,
              color: C.cyan,
            }),
            bullet("Finance-specific transformer model", C.green, "Replace generic VADER with FinBERT-style domain sentiment."),
            bullet("Backtesting module", C.amber, "Validate signal behavior against historical price and news windows."),
            bullet("Risk engine", C.red, "Add volatility, drawdown, and position-sizing constraints."),
            bullet("Broker sandbox integration", C.violet, "Simulate order execution while preserving educational boundaries."),
          ],
        ),
        panel(
          {
            columnSpan: 2,
            width: fill,
            height: hug,
            fill: "#0B1218",
            line: { fill: C.green, width: 1.4 },
            borderRadius: "rounded-lg",
            padding: { x: 40, y: 28 },
          },
          t(
            "Conclusion: SentiTrade converts noisy market narratives into an explainable, real-time decision-support layer that can be demonstrated, audited, and extended.",
            {
              size: 34,
              color: C.ink,
              lineSpacing: 1.12,
            },
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

  slide1();
  slide2();
  slide3();
  slide4();
  slide5();
  slide6();
  slide7();
  slide8();
  slide9();
  slide10();
  slide11();

  const pptxBlob = await PresentationFile.exportPptx(presentation);
  await writeBlob(PPTX_PATH, pptxBlob);

  const previewPaths = [];
  for (let i = 0; i < presentation.slides.count; i += 1) {
    const slide = presentation.slides.getItem(i);
    const png = await slide.export({ format: "png" });
    const previewPath = path.join(PREVIEW_DIR, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await writeBlob(previewPath, png);
    previewPaths.push(previewPath);
  }

  await fs.writeFile(
    path.join(SCRATCH_DIR, "deck-build.json"),
    JSON.stringify(
      {
        pptx: PPTX_PATH,
        slideCount: presentation.slides.count,
        previews: previewPaths,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(JSON.stringify({ pptx: PPTX_PATH, slideCount: presentation.slides.count, previews: previewPaths }, null, 2));
}

await main();
