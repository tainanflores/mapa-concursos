import assert from "node:assert/strict";
import test from "node:test";

import concursos from "../public/data/concursos.json" with { type: "json" };
import resumo from "../public/data/resumo.json" with { type: "json" };

const prioridade = {
  lotacao: 5,
  sede: 4,
  prova: 3,
  inscricao: 2,
  mencao: 1,
};

test("resumo reflete os dados finais de concursos", () => {
  const localizados = concursos.filter(
    (concurso) => !concurso.localizacaoPendente,
  ).length;

  const pendentes = concursos.filter(
    (concurso) => concurso.localizacaoPendente,
  ).length;

  assert.equal(resumo.total, concursos.length);
  assert.equal(resumo.localizados, localizados);
  assert.equal(resumo.pendentes, pendentes);
});

test("localização principal respeita a maior prioridade disponível", () => {
  for (const concurso of concursos) {
    const tipoPrincipal = prioridade[concurso.localizacao?.tipo];

    const localidadesClassificadas = concurso.localidades.filter(
      (localidade) => prioridade[localidade.tipo],
    );

    if (!tipoPrincipal || localidadesClassificadas.length === 0) {
      continue;
    }

    const maiorPrioridade = Math.max(
      ...localidadesClassificadas.map(
        (localidade) => prioridade[localidade.tipo] ?? 0,
      ),
    );

    assert.equal(
      tipoPrincipal,
      maiorPrioridade,
      concurso.orgao,
    );
  }
});
