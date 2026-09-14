const router = require("express").Router();
const { getCorrelation } = require("../controllers/correlationController");
const asyncHandler = require("../middleware/asyncHandler");
const { validateQuery } = require("../middleware/validate");
const { correlationQuery } = require("../schemas/query");

router.get("/correlation", validateQuery(correlationQuery), asyncHandler(getCorrelation));

module.exports = router;
