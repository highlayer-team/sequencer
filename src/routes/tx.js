const { HighlayerTx } = require("../structs/transaction");
const blake2s = require("bcrypto/lib/blake2s");
const { base58 } = require("bstring");
const { Verifier } = require("bip322-js");
const { signData } = require("../utils/signData");
const dgram = require("dgram");

// This client is used for sending data to the connected clients
const udpSender = dgram.createSocket("udp4");

module.exports = async function (fastify, opts) {
  fastify.post("/tx", async (req, res) => {
    try {
      let rawTx = req.body; // cbor encoded text
      let decodedTx = HighlayerTx.decode(rawTx);

      const validTx = Verifier.verifySignature(
        decodedTx.address,
        decodedTx.extractPrototype(), // Gets rid of signature, and possible sequencer data
        decodedTx.signature
      );

      if (!validTx) {
        return reply.code(400).send({ error: "Invalid Signature" });
      }

      // Increment and use the new length
      let ledgerPosition = ++global.ledgerLength;
      let bundlePosition = ++global.pendingTransactionLength;

      // Add sequencer information
      decodedTx.bundlePosition = bundlePosition;
      decodedTx.ledgerPosition = ledgerPosition;
      decodedTx.parentBundleHash = global.recentBundle;
      decodedTx.sequencerSignature = base58.encode(
        signData(Buffer.from(new HighlayerTx(decodedTx).encode()))
      );

      let signedTx = new HighlayerTx(decodedTx).encode();
      let buffer = base58.decode(signedTx);
      let txHash = base58.encode(blake2s.digest(Buffer.from(buffer), 32));

      if (await global.databases.transactions.get(txHash)) {
        return res.code(400).send({ error: "TX has already been uploaded" });
      }

      res.code(200).send({
        hash: txHash,
        bundlePosition: decodedTx.bundlePosition,
        ledgerPosition: decodedTx.ledgerPosition,
        parentBundleHash: decodedTx.parentBundleHash,
        sequencerSignature: decodedTx.sequencerSignature,
      });

      await global.databases.transactions.put(txHash, signedTx);
      await global.databases.ledger.put(ledgerPosition.toString(), txHash);
      await global.databases.toBeSettled.put(txHash, signedTx);

      clients.forEach((client) => {
        udpSender.send(
          Buffer.from(
            JSON.stringify({
              op: 20,
              transaction: signedTx,
            })
          ),
          client.port,
          client.address,
          (err) => {
            if (err)
              console.error(
                "Error sending message to client:",
                client.key,
                err
              );
            else console.log("Message sent to", client.key);
          }
        );
      });
    } catch (e) {
      console.log(e);
      return res.code(500).send({ error: e });
    }
  });
};
