const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();

function bindRequestContext(req, res, next) {
  storage.run({ req }, next);
}

// Fields added to every log line written during a request.
// Read at log time, so userId/role show up once authenticate() has run.
function getRequestContext() {
  const store = storage.getStore();
  if (!store) return undefined;
  const { req } = store;
  return {
    requestId: req.id,
    userId: req.user ? req.user.id : null,
    role: req.user ? req.user.role : null,
  };
}

module.exports = { bindRequestContext, getRequestContext };
