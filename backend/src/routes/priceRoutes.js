const router = require("express").Router();
const { getPrice } = require("../controllers/priceController");
const asyncHandler = require("../middleware/asyncHandler");
const { validateQuery } = require("../middleware/validate");
const { priceQuery } = require("../schemas/query");

router.get("/price", validateQuery(priceQuery), asyncHandler(getPrice));

module.exports = router;
