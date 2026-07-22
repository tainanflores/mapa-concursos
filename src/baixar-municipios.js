import { mkdir, writeFile } from "node:fs/promises";

const URL =
  "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv";

const DESTINO = "data/municipios.csv";

async function executar() {
  console.log("Baixando a base de municípios...");

  const resposta = await fetch(URL, {
    headers: {
      "User-Agent": "MapaConcursos/0.1",
      Accept: "text/csv,text/plain",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao baixar municípios: HTTP ${resposta.status}`);
  }

  const csv = await resposta.text();

  if (
    !csv.includes("codigo_ibge") ||
    !csv.includes("latitude") ||
    !csv.includes("longitude")
  ) {
    throw new Error("O arquivo recebido não possui os campos esperados.");
  }

  await mkdir("data", { recursive: true });
  await writeFile(DESTINO, csv, "utf8");

  console.log(`Base salva em ${DESTINO}`);
  console.log(`${csv.length} caracteres recebidos.`);
}

executar().catch((erro) => {
  console.error("Erro:", erro.message);
  process.exitCode = 1;
});
