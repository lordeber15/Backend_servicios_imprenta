const { parseYape } = require("./yape.parser");
const { parsePlin } = require("./plin.parser");

/** Parser por proveedor. El proveedor sale del packageName (ver config/notifier.js). */
const PARSERS = {
  YAPE: parseYape,
  PLIN: parsePlin,
};

module.exports = { PARSERS };
