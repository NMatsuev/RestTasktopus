const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();

function bindRequestContext(req, res, next) {
  storage.run({ requestId: req.id }, next);
}

function getRequestId() {
  const store = storage.getStore();
  return store ? store.requestId : undefined;
}

module.exports = { bindRequestContext, getRequestId };
