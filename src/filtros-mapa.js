const RAIO_TERRA_KM = 6371;

function grausParaRadianos(graus) {
  return (graus * Math.PI) / 180;
}

export function calcularDistanciaKm(latitudeOrigem, longitudeOrigem, latitudeDestino, longitudeDestino) {
  const diferencaLatitude = grausParaRadianos(latitudeDestino - latitudeOrigem);
  const diferencaLongitude = grausParaRadianos(longitudeDestino - longitudeOrigem);

  const a =
    Math.sin(diferencaLatitude / 2) ** 2 +
    Math.cos(grausParaRadianos(latitudeOrigem)) *
      Math.cos(grausParaRadianos(latitudeDestino)) *
      Math.sin(diferencaLongitude / 2) ** 2;

  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(a));
}

export function filtrarPinsMapa(pins, filtros = {}) {
  const {
    latitude,
    longitude,
    distanciaMaximaKm,
    uf,
    status,
    tipoSelecao,
    inscricaoDe,
    inscricaoAte,
  } = filtros;

  const possuiOrigem = Number.isFinite(latitude) && Number.isFinite(longitude);

  return pins
    .filter((pin) => !uf || pin.uf === uf)
    .filter((pin) => !status || pin.status === status)
    .filter((pin) => !tipoSelecao || pin.tipoSelecao === tipoSelecao)
    .filter((pin) => !inscricaoDe || pin.inscricaoFim >= inscricaoDe)
    .filter((pin) => !inscricaoAte || pin.inscricaoFim <= inscricaoAte)
    .map((pin) => ({
      ...pin,
      distanciaKm: possuiOrigem
        ? calcularDistanciaKm(latitude, longitude, pin.latitude, pin.longitude)
        : null,
    }))
    .filter(
      (pin) =>
        !Number.isFinite(distanciaMaximaKm) ||
        pin.distanciaKm === null ||
        pin.distanciaKm <= distanciaMaximaKm,
    )
    .sort((a, b) => {
      if (a.distanciaKm !== null && b.distanciaKm !== null) {
        return a.distanciaKm - b.distanciaKm;
      }

      return a.cidade.localeCompare(b.cidade, "pt-BR");
    });
}
