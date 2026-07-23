import assert from "node:assert/strict";
import test from "node:test";

import { dadosMudaram } from "../src/dados-atualizados.js";

test("ignora datas técnicas geradas durante a atualização", () => {
  const anterior = {
    geradoEm: "2026-07-22T10:00:00.000Z",
    concursos: [
      {
        id: "exemplo",
        coletadoEm: "2026-07-22T10:00:00.000Z",
        enriquecidoEm: "2026-07-22T10:00:00.000Z",
        orgao: "Órgão Exemplo",
      },
    ],
  };
  const atual = {
    concursos: [
      {
        orgao: "Órgão Exemplo",
        enriquecidoEm: "2026-07-23T10:00:00.000Z",
        id: "exemplo",
        coletadoEm: "2026-07-23T10:00:00.000Z",
      },
    ],
    geradoEm: "2026-07-23T10:00:00.000Z",
  };

  assert.equal(dadosMudaram(anterior, atual), false);
});

test("identifica uma mudança no conteúdo que será publicado", () => {
  const anterior = { concursos: [{ id: "exemplo", status: "aberto" }] };
  const atual = { concursos: [{ id: "exemplo", status: "encerrado" }] };

  assert.equal(dadosMudaram(anterior, atual), true);
});
