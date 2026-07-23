import { cp, mkdir } from "node:fs/promises";

const origem = new URL("../../public/data/", import.meta.url);
const destino = new URL("../public/data/", import.meta.url);

await mkdir(destino, { recursive: true });
await cp(origem, destino, { recursive: true });
