import assert from "node:assert/strict";
import test from "node:test";

import { calcularDistanciaKm, filtrarPinsMapa } from "../src/filtros-mapa.js";

const pins = [
  {
    id: "recife",
    cidade: "Recife",
    uf: "PE",
    latitude: -8.0476,
    longitude: -34.877,
    status: "aberto",
    tipoSelecao: "concurso_publico",
    inscricaoFim: "2026-08-10",
  },
  {
    id: "maceio",
    cidade: "Maceió",
    uf: "AL",
    latitude: -9.6658,
    longitude: -35.7353,
    status: "encerrado",
    tipoSelecao: "processo_seletivo",
    inscricaoFim: "2026-07-20",
  },
];

test("calcula distância aproximada entre coordenadas", () => {
  const distancia = calcularDistanciaKm(-9.6658, -35.7353, -8.0476, -34.877);

  assert.ok(distancia > 190 && distancia < 210);
});

test("filtra pins por distância e ordena pelo mais próximo", () => {
  const resultado = filtrarPinsMapa(pins, {
    latitude: -9.6658,
    longitude: -35.7353,
    distanciaMaximaKm: 50,
  });

  assert.deepEqual(resultado.map((pin) => pin.id), ["maceio"]);
  assert.ok(resultado[0].distanciaKm < 0.1);
});

test("filtra por UF, status, tipo e período de inscrição", () => {
  const resultado = filtrarPinsMapa(pins, {
    uf: "PE",
    status: "aberto",
    tipoSelecao: "concurso_publico",
    inscricaoDe: "2026-08-01",
    inscricaoAte: "2026-08-31",
  });

  assert.deepEqual(resultado.map((pin) => pin.id), ["recife"]);
});
