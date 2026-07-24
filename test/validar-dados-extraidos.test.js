import assert from "node:assert/strict";
import test from "node:test";

import {
  PROPORCAO_MINIMA_DO_TOTAL_ANTERIOR,
  validarResumoExtraido,
} from "../src/validar-dados-extraidos.js";

const resumoAnterior = {
  total: 100,
  localizados: 90,
  pendentes: 10,
};

test("aceita uma variação normal na quantidade de concursos", () => {
  const erros = validarResumoExtraido({
    anterior: resumoAnterior,
    atual: { total: 75, localizados: 68, pendentes: 7 },
  });

  assert.deepEqual(erros, []);
});

test("bloqueia extração vazia e totais inconsistentes", () => {
  const erros = validarResumoExtraido({
    anterior: resumoAnterior,
    atual: { total: 0, localizados: 0, pendentes: 1 },
  });

  assert.match(erros.join("\n"), /nenhum concurso/i);
  assert.match(erros.join("\n"), /não correspondem/i);
});

test("bloqueia queda abrupta em relação ao último conjunto publicado", () => {
  const totalAbaixoDoMinimo = Math.ceil(
    resumoAnterior.total * PROPORCAO_MINIMA_DO_TOTAL_ANTERIOR,
  ) - 1;
  const erros = validarResumoExtraido({
    anterior: resumoAnterior,
    atual: {
      total: totalAbaixoDoMinimo,
      localizados: totalAbaixoDoMinimo,
      pendentes: 0,
    },
  });

  assert.match(erros.join("\n"), /mínimo aceitável/i);
});
