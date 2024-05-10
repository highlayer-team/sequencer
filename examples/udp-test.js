const dgram = require("dgram");
const client = dgram.createSocket("udp4");
const SERVER_ADDRESS = "localhost";
const SERVER_PORT = 2881;
const { HighlayerTx } = require("../src/structs/transaction");

client.on("message", (msg, rinfo) => {
  const message = JSON.parse(msg.toString());
  console.log(message);
  if (message.op === 11) {
    console.log("Heartbeat ACK received from server");
  } else if (message.op === 20) {
    console.log(HighlayerTx.decode(message.transaction));
  }
});

function sendHeartbeat() {
  const heartbeatMessage = JSON.stringify({ op: 10 });
  client.send(heartbeatMessage, SERVER_PORT, SERVER_ADDRESS, (err) => {
    if (err) console.error("Failed to send heartbeat", err);
    else console.log("Heartbeat sent");
  });
}

// Send a heartbeat every minute
setInterval(sendHeartbeat, 60000);
