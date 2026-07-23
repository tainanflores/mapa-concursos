import assert from "node:assert/strict";
import test from "node:test";

import {
  agruparPinsPorMunicipio,
  criarLocalidadesParaMapa,
} from "../src/dados-mapa.js";

test("gera pins somente para localidades exibíveis", () => {
  const pins = criarLocalidadesParaMapa([
    {
      id: "concurso-exemplo",
      orgao: "Órgão Exemplo",
      titulo: "Título Exemplo",
      status: "aberto",
      tipoSelecao: "concurso_publico",
      urlPCI: "https://example.com",
      vagas: 1,
      salarioMaximo: 1000,
      inscricaoTexto: "Até 01/01/2027",
      inscricaoFim: "2027-01-01",
      localidades: [
        {
          codigoIbge: 1,
          cidade: "Cidade Exibível",
          uf: "SP",
          latitude: -23.5,
          longitude: -46.6,
          tipo: "lotacao",
          confianca: "alta",
          contexto: "1 vaga",
          exibirNoMapa: true,
        },
        {
          codigoIbge: 2,
          cidade: "Cidade Oculta",
          uf: "SP",
          latitude: -22.0,
          longitude: -47.0,
          tipo: "mencao",
          confianca: "baixa",
          contexto: "referência",
          exibirNoMapa: false,
        },
      ],
    },
  ]);

  assert.deepEqual(pins, [
    {
      id: "concurso-exemplo:1",
      concursoId: "concurso-exemplo",
      codigoIbge: 1,
      cidade: "Cidade Exibível",
      uf: "SP",
      latitude: -23.5,
      longitude: -46.6,
      tipoLocalidade: "lotacao",
      confiancaLocalidade: "alta",
      contextoLocalidade: "1 vaga",
      orgao: "Órgão Exemplo",
      titulo: "Título Exemplo",
      status: "aberto",
      tipoSelecao: "concurso_publico",
      urlPCI: "https://example.com",
      vagas: 1,
      salarioMaximo: 1000,
      inscricaoTexto: "Até 01/01/2027",
      inscricaoFim: "2027-01-01",
    },
  ]);
});

test("agrupa pins do mesmo município em um único ponto", () => {
  const pontos = agruparPinsPorMunicipio([
    {
      id: "concurso-a:1",
      concursoId: "concurso-a",
      codigoIbge: 1,
      cidade: "Cidade Exemplo",
      uf: "SP",
      latitude: -23.5,
      longitude: -46.6,
    },
    {
      id: "concurso-b:1",
      concursoId: "concurso-b",
      codigoIbge: 1,
      cidade: "Cidade Exemplo",
      uf: "SP",
      latitude: -23.5,
      longitude: -46.6,
    },
    {
      id: "concurso-c:2",
      concursoId: "concurso-c",
      codigoIbge: 2,
      cidade: "Outra Cidade",
      uf: "SP",
      latitude: -22.0,
      longitude: -47.0,
    },
  ]);

  assert.equal(pontos.length, 2);

  const cidadeExemplo = pontos.find((ponto) => ponto.codigoIbge === 1);

  assert.equal(cidadeExemplo.totalConcursos, 2);
  assert.deepEqual(
    cidadeExemplo.concursos.map((concurso) => concurso.concursoId),
    ["concurso-a", "concurso-b"],
  );
});
