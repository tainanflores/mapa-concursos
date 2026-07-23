import assert from "node:assert/strict";
import test from "node:test";

import { classificarContexto } from "../src/extrair-noticia.js";

test("classifica linha de cargo como lotação", () => {
  const tipo = classificarContexto(
    "Assistente de Alunos - Rondonópolis (1 vaga)",
    "Rondonópolis",
    "MT",
    "li",
  );

  assert.equal(tipo, "lotacao");
});

test("prioriza prova antes de indícios genéricos de vaga", () => {
  const tipo = classificarContexto(
    "As provas serão aplicadas em Cuiabá para os cargos com vagas abertas.",
    "Cuiabá",
    "MT",
    "p",
  );

  assert.equal(tipo, "prova");
});

test("mantém referência sem evidência como menção", () => {
  const tipo = classificarContexto(
    "O edital completo pode ser consultado em Teresina.",
    "Teresina",
    "PI",
    "p",
  );

  assert.equal(tipo, "mencao");
});
