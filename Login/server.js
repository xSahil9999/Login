const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const userStore = path.join(dataDir, "users.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(userStore)) {
  fs.writeFileSync(userStore, "[]", "utf8");
}

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const send = (res, status, payload, headers = {}) => {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req
      .on("data", (chunk) => {
        chunks.push(chunk);
        if (Buffer.concat(chunks).length > 1e6) {
          reject(new Error("Payload zu groß"));
          req.connection.destroy();
        }
      })
      .on("end", () => {
        const raw = Buffer.concat(chunks).toString();
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch (err) {
          reject(err);
        }
      })
      .on("error", reject);
  });

const readUsers = () => {
  try {
    return JSON.parse(fs.readFileSync(userStore, "utf8") || "[]");
  } catch {
    return [];
  }
};

const writeUsers = (list) => {
  fs.writeFileSync(userStore, JSON.stringify(list, null, 2));
};

const hashPassword = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

async function handleApi(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  try {
    if (req.method === "POST" && req.url === "/api/register") {
      const { name, email, password } = await readBody(req);
      if (!name || !email || !password) {
        return send(res, 400, { message: "Bitte alle Felder ausfüllen." });
      }
      if (password.length < 8) {
        return send(res, 400, { message: "Passwort zu kurz (min. 8 Zeichen)." });
      }
      const users = readUsers();
      const normalizedEmail = email.toLowerCase();
      if (users.some((u) => u.email === normalizedEmail)) {
        return send(res, 409, { message: "E-Mail bereits vergeben." });
      }
      const user = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        name,
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      writeUsers(users);
      return send(res, 201, { name: user.name, email: user.email });
    }

    if (req.method === "POST" && req.url === "/api/login") {
      const { email, password } = await readBody(req);
      if (!email || !password) {
        return send(res, 400, { message: "Bitte E-Mail und Passwort senden." });
      }
      const users = readUsers();
      const normalizedEmail = email.toLowerCase();
      const user = users.find((u) => u.email === normalizedEmail);
      if (!user) {
        return send(res, 404, { message: "Konto nicht gefunden." });
      }
      const hash = hashPassword(password);
      if (hash !== user.passwordHash) {
        return send(res, 401, { message: "Falsches Passwort." });
      }
      return send(res, 200, { name: user.name, email: user.email });
    }
  } catch (error) {
    return send(res, 500, { message: "Serverfehler", detail: error.message });
  }

  send(res, 404, { message: "Route nicht gefunden." });
}

function serveStatic(req, res) {
  const safePath = req.url.split("?")[0];
  const requested = safePath === "/" ? "/index.html" : safePath;
  const filePath = path.join(publicDir, requested);

  if (!filePath.startsWith(publicDir)) {
    send(res, 400, { message: "Ungültiger Pfad." });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(publicDir, "index.html"), (fallbackErr, fallback) => {
        if (fallbackErr) {
          res.writeHead(404);
          res.end("Not found");
        } else {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(fallback);
        }
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
