const { HighlayerTx } = require("../structs/transaction");

module.exports = async function (fastify, opts) {
  fastify.get("/ledger/:num", async (req, res) => {
    try {
      const num = req.params.num;

      const hash = await global.databases.ledger.get(num);

      if (hash) {
        let data = await global.databases.transactions.get(hash);

        return res.code(200).send(data.toString("utf8"));
      } else {
        // console.warn("TX does not exist with that number");
        return res.code(404).send("TX does not exist with that number");
      }
    } catch (error) {
      console.error("Error retrieving content:", error);
      res.send(500, "Internal Server Error");
    }
  });
};
