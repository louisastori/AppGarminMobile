import { createHttpServer } from "./index";

const port = Number(process.env.PORT ?? "3030");
const server = createHttpServer();

server.listen(port, () => {
  console.log(`nouvelleApp API listening on http://localhost:${port}`);
});
