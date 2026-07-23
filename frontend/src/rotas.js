const URL_OSRM = "https://router.project-osrm.org/route/v1/driving";

export async function calcularDistanciaPorRota({ origem, destino }) {
  const coordenadas = [
    `${origem.longitude},${origem.latitude}`,
    `${destino.longitude},${destino.latitude}`,
  ].join(";");

  const resposta = await fetch(`${URL_OSRM}/${coordenadas}?overview=false`);

  if (!resposta.ok) {
    throw new Error("Não foi possível calcular a rota neste momento.");
  }

  const dados = await resposta.json();
  const distanciaMetros = dados.routes?.[0]?.distance;

  if (typeof distanciaMetros !== "number") {
    throw new Error("Não foi encontrada uma rota para este concurso.");
  }

  return distanciaMetros;
}
