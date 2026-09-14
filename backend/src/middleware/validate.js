/**
 * Validate `req.query` against a zod schema. On success the parsed, coerced
 * result is placed on `req.validatedQuery` (Express 4/5 safe — we never
 * reassign `req.query`). On failure: 400 with a compact issue list.
 */
const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({
      error: "invalid_query",
      details: result.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(query)",
        message: issue.message
      }))
    });
    return;
  }

  req.validatedQuery = result.data;
  next();
};

module.exports = { validateQuery };
