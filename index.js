const http = require("http");
const websocket = require("websocket");

const clients = {};
let ip;
const httpServer = http.createServer((req, res) => {
  console.log(`${req.method.toUpperCase()} ${req.url}`);

  const respond = (code, data, contentType = "text/plain") => {
    res.writeHead(code, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  };

  respond(404, "Not Found");
});

const wsServer = new websocket.server({ httpServer });
wsServer.on("request", (req) => {
  console.log(`WS  ${JSON.stringify(req.resource)}`);
  console.log(`WS  ${JSON.stringify(req.socket.remoteAddress)}`);

  ip = req.socket.remoteAddress;

  if (ip == "::1" || ip == "::ffff:127.0.0.1") {
    ip = "127.0.0.1";
  }
  console.log("ip", ip);

  const { path } = req.resourceURL;
  const splitted = path.split("/");
  splitted.shift();
  const id = splitted[0];
  const device = splitted[1];
  const conn = req.accept(null, req.origin);
  conn.on("message", (data) => {
    if (data.type === "utf8") {
      // console.log(`from ${id} << ${data.utf8Data}`);

      const message = JSON.parse(data.utf8Data);
      const destId = message.id;
      const dest = clients[ip][destId];
      if (dest) {
        message.id = `${id}%${device}`;
        const data = JSON.stringify(message);
        console.log(`sending to ${destId} >> ${data}`);
        dest.send(data);
      } else {
        console.error(`Client ${destId} not found`);
      }
    }
  });
  conn.on("close", () => {
    delete clients[`${ip}`][`${id}%${device}`];

    if (Object.keys(clients[`${ip}`]).length == 0) {
      delete clients[`${ip}`];
    } else {
      Object.values(clients[`${ip}`]).forEach((i) => {
        i.send(JSON.stringify({ type: "peers", keys }));
      });
    }

    console.error(`Client ${id} disconnected`);
  });
  if (!clients[`${ip}`]) {
    clients[`${ip}`] = {};
  }

  clients[`${ip}`][`${id}%${device}`] = conn;
  let keys = Object.keys(clients[`${ip}`]);
  Object.values(clients[`${ip}`]).forEach((i) => {
    i.send(JSON.stringify({ type: "peers", keys }));
  });
  console.log(Object.keys(clients[ip]));
});

const endpoint = process.env.PORT || "8080";
const splitted = endpoint.split(":");
const port = splitted.pop();

httpServer.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
