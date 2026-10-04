const PLANS = Object.freeze({
  starter: { price: 49, botLimit: 2 },
  pro: { price: 149, botLimit: 3 },
  business: { price: 299, botLimit: 10 },
  enterprise: { price: 599, botLimit: Infinity }
});

function getBotLimit(planId) {
  return PLANS[planId]?.botLimit ?? 1;
}

module.exports = { PLANS, getBotLimit };