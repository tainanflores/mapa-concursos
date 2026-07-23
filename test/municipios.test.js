import assert from "node:assert/strict";
import test from "node:test";

import { carregarMunicipios, encontrarMunicipioNoTexto } from "../src/municipios.js";

const municipios = await carregarMunicipios();

function encontrar(texto, uf, permitirNomeInstituicao = false) {
  return encontrarMunicipioNoTexto({
    texto,
    uf,
    municipios,
    permitirNomeInstituicao,
  });
}

test("reconhece municípios curtos e nomes com hífen", () => {
  assert.equal(encontrar("Prefeitura de Itá", "SC")?.nome, "Itá");
  assert.equal(encontrar("Prefeitura de Exu", "PE")?.nome, "Exu");
  assert.equal(encontrar("Prefeitura de Grão-Pará", "SC")?.nome, "Grão Pará");
  assert.equal(encontrar("Prefeitura de Grão Pará", "SC")?.nome, "Grão Pará");
});

test("permite nome de instituição somente quando solicitado", () => {
  const texto = "Fundação Educacional de Andradina";

  assert.equal(encontrar(texto, "SP"), null);
  assert.equal(encontrar(texto, "SP", true)?.nome, "Andradina");
});

test("bloqueia estados e nomes de instituições como falsos municípios", () => {
  assert.equal(encontrar("Estado de São Paulo", "SP"), null);
  assert.equal(encontrar("Hospital Cristiano Machado", "MG"), null);
  assert.equal(encontrar("Godofredo Viana", "MA")?.nome, "Godofredo Viana");
});
