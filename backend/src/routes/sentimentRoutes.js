const router = require("express").Router();
const { getSentiment, getTrend } = require("../controllers/sentimentController");
const asyncHandler = require("../middleware/asyncHandler");
const { validateQuery } = require("../middleware/validate");
const { sentimentQuery, trendQuery } = require("../schemas/query");

router.get("/sentiment", validateQuery(sentimentQuery), asyncHandler(getSentiment));
router.get("/sentiment/trend", validateQuery(trendQuery), asyncHandler(getTrend));

module.exports = router;
