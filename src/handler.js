const bcoin = require("../bcoin");
const server = require("fastify")({
  logger: true,
});
const AutoLoad = require("@fastify/autoload");
const path = require("path");
const dgram = require("dgram");

global.clients = [];
const HEARTBEAT_INTERVAL = 60000 * 3; // 3 minutes

module.exports = async function handler() {
  await startWebserver(server);

  await server.listen({ port: global.config.httpPort }).then(() => {
    console.log(`Webserver started at :${config.httpPort}`);
  });

  await startUdpServer().then(() => {
    setInterval(checkHeartbeats, 60000);
  });
};

const startWebserver = async function (server, opts) {
  // This loads all plugins defined in routes
  // define your routes in one of these
  server.register(AutoLoad, {
    dir: path.join(__dirname, "routes"),
    options: Object.assign({}, opts),
  });
};

const startUdpServer = async function () {
  const udpServer = dgram.createSocket("udp4");

  udpServer.on("error", (err) => {
    console.log(`UDP error: ${err.stack}`);
    udpServer.close();
  });

  udpServer.on("message", (msg, rinfo) => {
    const message = JSON.parse(msg.toString());
    console.log(
      `Server received: ${message.op} from ${rinfo.address}:${rinfo.port}`
    );

    const clientKey = `${rinfo.address}:${rinfo.port}`;
    const index = clients.findIndex((client) => client.key === clientKey);

    if (message.op === 10) {
      // Heartbeat received
      if (index === -1) {
        clients.push({
          key: clientKey,
          address: rinfo.address,
          port: rinfo.port,
          lastHeartbeat: Date.now(),
        });
        console.log("Added new client:", clientKey);
      } else {
        clients[index].lastHeartbeat = Date.now();
        console.log("Updated heartbeat for:", clientKey);
      }

      // Send ACK for heartbeat
      const ackMessage = JSON.stringify({ op: 11 });
      udpServer.send(ackMessage, rinfo.port, rinfo.address, (err) => {
        if (err) console.error("Error sending heartbeat ACK:", err);
        else console.log("Heartbeat ACK sent to", clientKey);
      });
    }
  });

  udpServer.on("listening", () => {
    const address = udpServer.address();
    console.log(`UDP Server listening ${address.address}:${address.port}`);
  });

  udpServer.bind(global.config.udpPort);
};

function checkHeartbeats() {
  const now = Date.now();
  for (let i = clients.length - 1; i >= 0; i--) {
    if (now - clients[i].lastHeartbeat > HEARTBEAT_INTERVAL) {
      console.log(`Client ${clients[i].key} removed due to timeout.`);
      clients.splice(i, 1); // Remove the client
    }
  }
}
