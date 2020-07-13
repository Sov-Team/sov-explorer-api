"use strict";var _serviceFactory = require("../serviceFactory");

const serviceConfig = _serviceFactory.services.ROUTER;

async function main() {
  try {
    const { router, startService } = await (0, _serviceFactory.createRouter)(serviceConfig, { services: _serviceFactory.services });
    await startService();
    router.start();
  } catch (err) {
    console.error(err);
    process.exit(9);
  }
}

main();