import { Hono } from "hono";

const memos = new Hono<{ Bindings: Env }>();

memos.get("/", (c) => c.json({ message: "Not implemented" }, 501));
memos.get("/:id", (c) => c.json({ message: "Not implemented" }, 501));
memos.post("/", (c) => c.json({ message: "Not implemented" }, 501));
memos.patch("/:id", (c) => c.json({ message: "Not implemented" }, 501));
memos.delete("/:id", (c) => c.json({ message: "Not implemented" }, 501));

export default memos;
