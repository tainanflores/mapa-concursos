import { mkdir, writeFile } from "node:fs/promises";

const URL = "https://www.pciconcursos.com.br/concursos/";
const DESTINO = "data/pci-concursos.html";

export async function baixarPaginaPCI() {
  console.log("Baixando a página geral do PCI Concursos...");

  const resposta = await fetch(URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; MapaConcursos/0.1; projeto pessoal)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });

  if (!resposta.ok) {
    throw new Error(`PCI Concursos respondeu com HTTP ${resposta.status}`);
  }

  const html = await resposta.text();

  if (!html.includes("pciconcursos") && !html.includes("PCI Concursos")) {
    throw new Error("O conteúdo recebido não parece ser a página do PCI.");
  }

  await mkdir("data", { recursive: true });
  await writeFile(DESTINO, html, "utf8");

  console.log(`Página salva em ${DESTINO}`);
  console.log(`${html.length} caracteres recebidos.`);

  return html;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  baixarPaginaPCI().catch((erro) => {
    console.error("Erro:", erro.message);
    process.exitCode = 1;
  });
}
