import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { dadosMudaram } from "./dados-atualizados.js";

const executarArquivo = promisify(execFile);

const ARQUIVOS_DE_DADOS = [
  "public/data/concursos.json",
  "public/data/resumo.json",
  "public/data/localidades.json",
  "public/data/pontos-mapa.json",
  "public/data/municipios.json",
];

async function lerArquivoDoCommit(caminho) {
  try {
    const { stdout } = await executarArquivo("git", ["show", `HEAD:${caminho}`]);

    return JSON.parse(stdout);
  } catch (erro) {
    /* O arquivo ainda não existe no primeiro envio de dados ao repositório. */
    if (erro && typeof erro === "object" && erro.code === 128) {
      return null;
    }

    throw erro;
  }
}

async function houveAlteracaoEfetiva() {
  for (const caminho of ARQUIVOS_DE_DADOS) {
    const [conteudoAnterior, conteudoAtual] = await Promise.all([
      lerArquivoDoCommit(caminho),
      readFile(caminho, "utf8").then(JSON.parse),
    ]);

    if (conteudoAnterior === null || dadosMudaram(conteudoAnterior, conteudoAtual)) {
      return true;
    }
  }

  return false;
}

process.stdout.write(`${(await houveAlteracaoEfetiva()) ? "true" : "false"}\n`);
