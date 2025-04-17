const http = require("http");

http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Alow-Origin", "*");
  })
  .listen(3001, "localhost");
