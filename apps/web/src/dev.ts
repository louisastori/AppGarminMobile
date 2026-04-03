import { createServer } from "node:http";
import { renderWebDashboard } from "./index";

const port = Number(process.env.PORT ?? "4173");

const server = createServer((_request, response) => {
  response.statusCode = 200;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(renderWebDashboard());
});

server.listen(port, () => {
  console.log(`nouvelleApp web preview listening on http://localhost:${port}`);
});
