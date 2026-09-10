const { tokenize } = require("./simhash");

/**
 * Jaccard similarity of two texts' token sets. For short strings like
 * headlines this is more reliable than SimHash Hamming distance at
 * catching the same story reworded by a different outlet.
 */
const jaccard = (a, b) => {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size || !B.size) return 0;

  let intersection = 0;
  for (const t of A) if (B.has(t)) intersection += 1;
  return intersection / (A.size + B.size - intersection);
};

const isRewordedDuplicate = (a, b, threshold = 0.6) => jaccard(a, b) >= threshold;

module.exports = { jaccard, isRewordedDuplicate };
