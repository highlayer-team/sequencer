const { HighlayerTx } = require("../structs/transaction");
const blake2s = require("bcrypto/lib/blake2s");
const { base58 } = require("bstring");
const { Verifier } = require("bip322-js");
const { signData } = require("../utils/signData");
const dgram = require("dgram");
const msgpackr = require("msgpackr");

// This client is used for sending data to the connected clients
const udpSender = dgram.createSocket("udp4");

function handleTransaction(res, req, data) {
  const startTime = process.hrtime(); // Start timing
  try {
    let decodedTx = HighlayerTx.decode(data);

    if (decodedTx.actions.length <= 0) {
      res.writeStatus("400 Bad Request");
      res.tryEnd(JSON.stringify({ Error: "Invalid TX Format" }));
      return;
    }

    const validTx = Verifier.verifySignature(
      decodedTx.address,
      decodedTx.extractedRawTxID(),
      decodedTx.signature
    );

    let endTime = process.hrtime(startTime); // End timing
    let duration = endTime[0] * 1000 + endTime[1] / 1000000; // Convert to milliseconds
    console.log(`Time for sig to finish: ${duration.toFixed(3)} ms`);

    if (!validTx) {
      res.writeStatus("400 Bad Request");
      res.tryEnd(JSON.stringify({ Error: "Invalid Signature" }));
      return;
    }

    if (
      decodedTx.actions.length > 1 ||
      (decodedTx.actions[0] &&
        decodedTx.actions[0].action !== "sequencerDeposit")
    ) {
      let userBalance = global.databases.balances.get(decodedTx.address);

      if (!userBalance) {
        res.cork(() => {
          res.writeStatus("400 Bad Request");
          res.tryEnd(
            JSON.stringify({ Error: "Insufficient Sequencer Balance" })
          );
        });
        return;
      }

      let bytes = Buffer.byteLength(data, "utf8");
      let fee = bytes * global.config.feePerByte;

      let newBalance = BigInt(userBalance) - BigInt(fee);

      if (newBalance < 0) {
        res.cork(() => {
          res.writeStatus("400 Bad Request");
          res.tryEnd(
            JSON.stringify({ Error: "Insufficient Sequencer Balance" })
          );
        });
        return;
      }

      global.databases.balances.put(decodedTx.address, newBalance.toString());
    }

    endTime = process.hrtime(startTime); // End timing
    duration = endTime[0] * 1000 + endTime[1] / 1000000; // Convert to milliseconds
    console.log(`Time to check fee and change bal: ${duration.toFixed(3)} ms`);

    // Increment and use the new length
    let ledgerPosition = ++global.sequencerTxIndex;
    let bundlePosition = ++global.pendingTransactionLength;

    // Add sequencer information
    decodedTx.bundlePosition = bundlePosition;
    decodedTx.sequencerTxIndex = ledgerPosition;
    decodedTx.parentBundleHash = global.recentBundle;
    decodedTx.sequencerSignature = base58.encode(
      signData(Buffer.from(decodedTx.rawTxID()))
    );

    let signedTx = new HighlayerTx(decodedTx).encode();
    let buffer = base58.decode(signedTx);
    let txHash = base58.encode(blake2s.digest(Buffer.from(buffer), 32));

    endTime = process.hrtime(startTime); // End timing
    duration = endTime[0] * 1000 + endTime[1] / 1000000; // Convert to milliseconds
    console.log(`Time to add sequencer hash: ${duration.toFixed(3)} ms`);

    if (global.databases.transactions.get(txHash)) {
      res.cork(() => {
        res.writeStatus("400 Bad Request");
        res.tryEnd(JSON.stringify({ Error: "TX has already been uploaded" }));
      });
      return;
    }

    endTime = process.hrtime(startTime); // End timing
    duration = endTime[0] * 1000 + endTime[1] / 1000000; // Convert to milliseconds
    console.log(`Total Duration: ${duration.toFixed(3)} ms`);

    res.cork(() => {
      res.writeStatus("200 OK");
      res.writeHeader("Content-Type", "application/json");
      res.tryEnd(
        JSON.stringify({
          hash: txHash,
          bundlePosition: decodedTx.bundlePosition,
          sequencerTxIndex: decodedTx.sequencerTxIndex,
          parentBundleHash: decodedTx.parentBundleHash,
          sequencerSignature: decodedTx.sequencerSignature,
        })
      );
    });

    global.databases.transactions.put(txHash, signedTx),
      global.databases.sequencerTxIndex.put(ledgerPosition.toString(), txHash),
      global.databases.toBeSettled.put(txHash, signedTx);

    clients.forEach((client) => {
      udpSender.send(
        msgpackr.encode({
          op: 21,
          transaction: signedTx,
          sequencerTxIndex: ledgerPosition,
        }),
        client.port,
        client.address,
        (err) => {
          if (err)
            console.error("Error sending message to client:", client.key, err);
        }
      );
    });
  } catch (e) {
    console.error(e);
    res.cork(() => {
      res.writeStatus("500 Internal Server Error");
      res.tryEnd({
        Error: "Internal Server Error",
      });
    });
  }
}

module.exports = {
  path: "/tx",
  method: "post",
  handler: (res, req) => {
    res.onAborted(() => {
      res.aborted = true;
    });
    let dataStream = [];

    res.onData((data, isLast) => {
      let decodedData = handleArrayBuffer(data);
      dataStream.push(decodedData);

      if (isLast) {
        try {
          handleTransaction(res, req, dataStream.join(""));
        } catch (e) {
          console.log(e);
        }
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
