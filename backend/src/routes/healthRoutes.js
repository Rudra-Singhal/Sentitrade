const router = require("express").Router();
const { health, ready, showMetrics } = require("../controllers/healthController");

router.get("/health", health);
router.get("/ready", ready);
router.get("/metrics", showMetrics);

module.exports = router;
