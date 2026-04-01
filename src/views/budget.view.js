function buildBudgetsResponse(budgets) {
  return {
    ok: true,
    budgets,
  };
}

function buildBudgetResponse(budget, message) {
  return {
    ok: true,
    message,
    budget,
  };
}

module.exports = {
  buildBudgetsResponse,
  buildBudgetResponse,
};
