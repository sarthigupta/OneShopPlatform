import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import authRouter from "./routes/auth.js";
import shopsRouter from "./routes/shops.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json());
app.use("/api/auth", authRouter);

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "api" });
});

app.get("/", (_request, response) => {
  response.json({ service: "oneshop-api", status: "running" });
});

app.use("/api/shops", shopsRouter);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
