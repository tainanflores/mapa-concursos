export function criarLocalidadesParaMapa(concursos) {
  return concursos.flatMap((concurso) =>
    (concurso.localidades ?? [])
      .filter((localidade) => localidade.exibirNoMapa === true)
      .map((localidade) => ({
        id: `${concurso.id}:${localidade.codigoIbge}`,
        concursoId: concurso.id,

        codigoIbge: localidade.codigoIbge,
        cidade: localidade.cidade,
        uf: localidade.uf,
        latitude: localidade.latitude,
        longitude: localidade.longitude,
        tipoLocalidade: localidade.tipo,
        confiancaLocalidade: localidade.confianca,
        contextoLocalidade: localidade.contexto,

        orgao: concurso.orgao,
        titulo: concurso.titulo,
        status: concurso.status,
        tipoSelecao: concurso.tipoSelecao,
        urlPCI: concurso.urlPCI,
        vagas: concurso.vagas,
        salarioMaximo: concurso.salarioMaximo,
        inscricaoTexto: concurso.inscricaoTexto,
        inscricaoFim: concurso.inscricaoFim,
      })),
  );
}

export function criarMunicipiosParaBusca(municipios) {
  return municipios
    .map((municipio) => ({
      codigoIbge: municipio.codigoIbge,
      cidade: municipio.nome,
      uf: municipio.uf,
      latitude: municipio.latitude,
      longitude: municipio.longitude,
    }))
    .sort(
      (a, b) =>
        a.uf.localeCompare(b.uf, "pt-BR") ||
        a.cidade.localeCompare(b.cidade, "pt-BR"),
    );
}

export function agruparPinsPorMunicipio(pins) {
  const grupos = new Map();

  for (const pin of pins) {
    const existente = grupos.get(pin.codigoIbge);

    if (existente) {
      existente.concursos.push(pin);
      continue;
    }

    grupos.set(pin.codigoIbge, {
      codigoIbge: pin.codigoIbge,
      cidade: pin.cidade,
      uf: pin.uf,
      latitude: pin.latitude,
      longitude: pin.longitude,
      concursos: [pin],
    });
  }

  return [...grupos.values()]
    .map((grupo) => ({
      ...grupo,
      totalConcursos: grupo.concursos.length,
    }))
    .sort(
      (a, b) =>
        a.uf.localeCompare(b.uf, "pt-BR") ||
        a.cidade.localeCompare(b.cidade, "pt-BR"),
    );
}
