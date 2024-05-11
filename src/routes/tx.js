const { HighlayerTx } = require("../structs/transaction");
const blake2s = require("bcrypto/lib/blake2s");
const { base58 } = require("bstring");
const { Verifier } = require("bip322-js");
const { signData } = require("../utils/signData");
const dgram = require("dgram");

// This client is used for sending data to the connected clients
const udpSender = dgram.createSocket("udp4");

async function handleTransaction(res, req, data) {
  try {
    let decodedData = handleArrayBuffer(data);
    let decodedTx = HighlayerTx.decode(decodedData);

    if (decodedTx.actions.length <= 0) {
      res.writeStatus("400 Bad Request");
      res.tryEnd(JSON.stringify({ error: "Invalid TX Format" }));
      return;
    }

    const validTx = Verifier.verifySignature(
      decodedTx.address,
      decodedTx.extractPrototype(), // Gets rid of signature, and possible sequencer data
      decodedTx.signature
    );

    if (!validTx) {
      res.writeStatus("400 Bad Request");
      res.tryEnd(JSON.stringify({ error: "Invalid Signature" }));
      return;
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
      res.writeStatus("400 Bad Request");
      res.tryEnd(JSON.stringify({ error: "TX has already been uploaded" }));
      return;
    }

    res.writeStatus("200 OK");
    res.writeHeader("Content-Type", "application/json");
    res.tryEnd(
      JSON.stringify({
        hash: txHash,
        bundlePosition: decodedTx.bundlePosition,
        ledgerPosition: decodedTx.ledgerPosition,
        parentBundleHash: decodedTx.parentBundleHash,
        sequencerSignature: decodedTx.sequencerSignature,
      })
    );

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
            console.error("Error sending message to client:", client.key, err);
          else console.log("Message sent to", client.key);
        }
      );
    });
  } catch (e) {
    console.log(e);
    res.writeStatus("500 Internal Server Error");
    res.tryEnd("Internal Server Error");
    return;
  }
}

module.exports = {
  path: "/tx",
  method: "post",
  handler: async (res, req) => {
    res.onAborted(() => {
      res.aborted = true;
    });

    await res.onData(async (data) => {
      try {
        await handleTransaction(res, req, data);
      } catch (e) {
        console.log(e);
      }
    });
  },
};

const handleArrayBuffer = (message) => {
  if (message instanceof ArrayBuffer) {
    const decoder = new TextDecoder();
    return decoder.decode(message);
  }
  return message;
};
