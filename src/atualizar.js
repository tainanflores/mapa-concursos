import { baixarPaginaPCI } from "./baixar-pci.js";
import { extrairListagem } from "./extrair-listagem.js";

async function atualizar() {
  console.log("Iniciando atualização...");

  await baixarPaginaPCI();
  await extrairListagem();

  console.log("Atualização concluída.");
}

atualizar().catch((erro) => {
  console.error("Falha na atualização:");
  console.error(erro);
  process.exitCode = 1;
});
