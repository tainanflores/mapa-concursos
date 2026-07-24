import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { validarResumoExtraido } from "./validar-dados-extraidos.js";

const executarArquivo = promisify(execFile);
const CAMINHO_RESUMO = "public/data/resumo.json";

async function lerResumoDoCommit() {
  try {
    const { stdout } = await executarArquivo("git", [
      "show",
      `HEAD:${CAMINHO_RESUMO}`,
    ]);

    return JSON.parse(stdout);
  } catch (erro) {
    /* Na primeira publicação não existe referência anterior para comparar. */
    if (erro && typeof erro === "object" && erro.code === 128) {
      return null;
    }

    throw erro;
  }
}

const [anterior, conteudoAtual] = await Promise.all([
  lerResumoDoCommit(),
  readFile(CAMINHO_RESUMO, "utf8"),
]);
const erros = validarResumoExtraido({
  anterior,
  atual: JSON.parse(conteudoAtual),
});

if (erros.length > 0) {
  console.error("Resultado da extração bloqueado por validação de segurança:");

  for (const erro of erros) {
    console.error(`- ${erro}`);
  }

  process.exitCode = 1;
} else {
  console.log("Resultado da extração aprovado pela validação de segurança.");
}
