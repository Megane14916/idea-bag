import { Hono } from "hono";

const labels = new Hono<{ Bindings: Env }>();

labels.get("/", (c) => c.json({ message: "Not implemented" }, 501));
labels.post("/", (c) => c.json({ message: "Not implemented" }, 501));
labels.patch("/:id", (c) => c.json({ message: "Not implemented" }, 501));
labels.delete("/:id", (c) => c.json({ message: "Not implemented" }, 501));

export default labels;
