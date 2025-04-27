import { createServer } from "http";
import { server } from "websocket";
import { createLogger, transports } from "winston";
import { isIPv4, isIPv6 } from "net";
import validator from "validator";
import dotenv from "dotenv";

dotenv.config();

// constants
const UPDATE_INTERVAL_MS = 1000;
const INACTIVITY_TIMEOUT_MS = 1000 * 60 * 1; // 5 minutes

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  transports: [new transports.Console()],
});

const httpServer = createServer((req, res) => {
  const respond = (code, data, contentType = "text/plain") => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS.split(",");
    res.writeHead(code, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": allowedOrigins,
    });
    res.end(data);
  };
  respond(404, "Not Found");
});

const clients = {};
const pendingUpdates = new Set();

setInterval(() => {
  pendingUpdates.forEach((ip) => {
    const keys = Object.keys(clients[ip] || {});
    const message = JSON.stringify({ type: "peers", keys });

    Object.values(clients[ip] || {}).forEach((client) => {
      client.send(message);
    });
  });

  pendingUpdates.clear();
}, UPDATE_INTERVAL_MS);

const wsServer = new server({ httpServer });

wsServer.on("request", (req, socket) => {
  let ip = req.remoteAddress;
  console.log(process.env.ALLOWED_ORIGINS, "allowed");
  if (isIPv6(ip)) {
    if (ip.startsWith("::ffff:"))
      ip = ip.split("::ffff:")[1]; // Convert IPv6-mapped IPv4 to IPv4
    else if (ip == "::1") ip = "127.0.0.1";
  }

  if (!isIPv4(ip) && !isIPv6(ip)) {
    logger.error(`Invalid IP address: ${req.remoteAddress}`);
    req.reject(403, "Invalid client ID or device");
    return;
  }
  const { path } = req.resourceURL;
  const splitted = path.split("/");
  splitted.shift();
  const id = splitted[0];
  const device = splitted[1];

  if (
    !validator.isAlphanumeric(id) ||
    !validator.isAlphanumeric(device) ||
    id.length > 10 ||
    device.length > 10
  ) {
    logger.error("Invalid client ID or device");
    req.reject();
    return;
  }

  const conn = req.accept(null, req.origin);

  let inactivityTimeout;

  const setInactivityTimeout = () => {
    clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(() => {
      logger.warn(`Client ${id} at ${ip} timed out due to inactivity`);
      conn.close();
    }, INACTIVITY_TIMEOUT_MS);
  };
  // Set the initial inactivity timeout
  setInactivityTimeout();

  conn.on("message", (data) => {
    setInactivityTimeout();
    if (data.type === "utf8") {
      try {
        const message = JSON.parse(data.utf8Data);
        const destinationId = message.id;
        const destination = clients[ip]?.[destinationId];

        if (clients[ip] && destination) {
          message.id = `${id}%${device}`;
          const messageData = JSON.stringify(message);
          logger.info(`${id}%${device} -> sending to ${destinationId}`);
          destination.send(messageData);
        } else {
          logger.error(`Client ${destinationId} not found`);
        }
      } catch (error) {
        logger.error(
          `Invalid message format from client ${id} at ${ip}:`,
          error
        );
        conn.close();
      }
    }
  });

  conn.on("close", () => {
    try {
      clearTimeout(inactivityTimeout);
      delete clients[ip]?.[`${id}%${device}`];
      if (clients[ip] && Object.keys(clients[ip]).length == 0) {
        delete clients[ip];
        pendingUpdates.delete(ip);
        logger.info("room deleted");
      } else {
        pendingUpdates.add(ip);
      }
    } catch (err) {
      logger.error("Error deleting client:", err);
    }
    logger.warn(`Client ${id} disconnected`);
  });

  if (!clients[ip]) {
    clients[ip] = {};
    logger.info(`New room created for IP ${ip}`);
  }

  if (clients[ip][`${id}%${device}`]) {
    logger.warn(
      `Client ${id} (${device}) at ${ip} is reconnecting, replacing the old connection`
    );
  }

  clients[ip][`${id}%${device}`] = conn;
  pendingUpdates.add(ip);
  logger.info(`Client ${id} (${device}) at ${ip} added to clients object`);
  logger.debug(
    `Current clients for IP ${ip}: ${Object.keys(clients[ip]).join(", ")}`
  );
});

const port = Number(process.env.PORT) || 8080;

httpServer.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});
