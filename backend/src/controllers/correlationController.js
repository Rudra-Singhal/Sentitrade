const { getSnapshot } = require("../services/snapshotService");

const getCorrelation = async (req, res) => {
  const { asset, range } = req.validatedQuery;
  const snap = await getSnapshot(asset, range);
  res.json(snap.correlation);
};

module.exports = { getCorrelation };
