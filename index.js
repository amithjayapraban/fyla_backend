const http = require("http");
const websocket = require("websocket");

const clients = {};

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
  console.log(`WS  ${req.resource}`);
  console.log(Object.keys(clients));
  const { path } = req.resourceURL;
  const splitted = path.split("/");
  splitted.shift();
  const id = splitted[0];
  const device = splitted[1];
  const conn = req.accept(null, req.origin);
  conn.on("message", (data) => {
    if (data.type === "utf8") {
      console.log(`from ${id} << ${data.utf8Data}`);

      const message = JSON.parse(data.utf8Data);
      const destId = message.id;
      const dest = clients[destId];
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
    delete clients[`${id}%${device}`]; 
    console.error(`Client ${id} disconnected`);
  });

  clients[`${id}%${device}`] = conn;
  let keys = Object.keys(clients);
  Object.values(clients).forEach((i) => {
    i.send(JSON.stringify({ type: "peers", keys }));
  });
});

const endpoint = process.env.PORT || "8000";
const splitted = endpoint.split(":");
const port = splitted.pop();


httpServer.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
