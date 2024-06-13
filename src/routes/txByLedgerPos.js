const { HighlayerTx } = require("../structs/transaction");
module.exports = {
  path: "/ledger/:num",
  method: "get",
  handler: async (res, req) => {
    try {
      const num = req.getParameter(0);

      const hash = await global.databases.sequencerTxIndex.get(num);

      if (hash) {
        let data = await global.databases.transactions.get(hash);

        res.writeHeader("Content-Type", "application/vnd.msgpack");
        return res.tryEnd(data);
      } else {
        // console.warn("TX does not exist with that number");
        res.writeStatus("404 Not Found");
        return res.tryEnd(msgpackr.encode({
          Error: "TX does not exist with that number",
        }));
      }
    } catch (error) {
      res.writeStatus("500 Internal Server Error");
      return res.tryEnd("Internal Server Error");
    }
  },
};
