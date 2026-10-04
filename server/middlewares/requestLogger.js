module.exports = function createRequestLogger(label = 'HTTP') {
  return (req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      console.log(`[${label}] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`);
    });
    next();
  };
};