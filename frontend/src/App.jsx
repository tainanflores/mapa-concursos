import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "./App.css";
import { filtrarPinsMapa } from "../../src/filtros-mapa.js";
import { calcularDistanciaPorRota } from "./rotas.js";

const CENTRO_DO_BRASIL = [-14.235, -51.9253];

const ROTULOS_TIPO_SELECAO = {
  concurso_publico: "Concurso público",
  processo_seletivo: "Processo seletivo",
  selecao_publica: "Seleção pública",
  misto: "Concurso e processo seletivo",
  indefinido: "Não informado",
};

const FILTROS_INICIAIS = {
  distanciaMaximaKm: "",
  uf: "",
  status: "",
  tipoSelecao: "",
  inscricoesEmAndamento: false,
  inscricaoAte: "",
};

function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function formatarData(data) {
  if (!data) return "Não informada";

  const apenasData = String(data).match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (apenasData) return `${apenasData[3]}/${apenasData[2]}/${apenasData[1]}`;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(data));
}

function formatarSalario(valor) {
  if (typeof valor !== "number") return "Não informado";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function formatarDistancia(distanciaMetros) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(distanciaMetros / 1000);
}

function agruparPinsPorMunicipio(pins) {
  const grupos = new Map();

  for (const pin of pins) {
    const grupo = grupos.get(pin.codigoIbge);

    if (grupo) {
      grupo.concursos.push(pin);
      continue;
    }

    grupos.set(pin.codigoIbge, {
      codigoIbge: pin.codigoIbge,
      cidade: pin.cidade,
      uf: pin.uf,
      latitude: pin.latitude,
      longitude: pin.longitude,
      distanciaKm: pin.distanciaKm,
      concursos: [pin],
    });
  }

  return [...grupos.values()].map((grupo) => ({
    ...grupo,
    totalConcursos: grupo.concursos.length,
  }));
}

function RecentrarMapa({ localizacao }) {
  const mapa = useMap();

  useEffect(() => {
    if (localizacao) {
      mapa.setView([localizacao.latitude, localizacao.longitude], 10);
    }
  }, [localizacao, mapa]);

  return null;
}

function DetalhesConcurso({
  concurso,
  destino,
  distanciaRota,
  calculandoRota,
  erroRota,
  possuiOrigem,
  aoFechar,
}) {
  if (!concurso) return null;

  const localidades = concurso.localidades ?? [];

  return (
    <div className="sobreposicao-detalhes" role="presentation" onMouseDown={aoFechar}>
      <section
        aria-labelledby="titulo-detalhes"
        aria-modal="true"
        className="painel-detalhes"
        role="dialog"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="cabecalho-detalhes">
          <button
            className="fechar-detalhes"
            type="button"
            aria-label="Fechar detalhes"
            onClick={aoFechar}
          >
            ×
          </button>
          <p className="sobretitulo">Detalhes do concurso</p>
          <h2 id="titulo-detalhes">{concurso.titulo}</h2>
        </div>
        <p className="orgao">{concurso.orgao}</p>

        <div className="distancia-rota">
          <strong>Distância por rota até {destino.cidade}/{destino.uf}</strong>
          {!possuiOrigem && <p>Defina sua localização ou busque uma cidade para calcular.</p>}
          {possuiOrigem && calculandoRota && <p>Calculando rota...</p>}
          {possuiOrigem && distanciaRota !== null && (
            <p>{formatarDistancia(distanciaRota)} km de carro</p>
          )}
          {possuiOrigem && erroRota && <p>{erroRota}</p>}
        </div>

        <dl className="dados-concurso">
          <div>
            <dt>Status</dt>
            <dd>{concurso.status === "aberto" ? "Aberto" : "Encerrado"}</dd>
          </div>
          <div>
            <dt>Tipo de seleção</dt>
            <dd>{ROTULOS_TIPO_SELECAO[concurso.tipoSelecao] ?? concurso.tipoSelecao}</dd>
          </div>
          <div>
            <dt>Vagas</dt>
            <dd>{concurso.vagas ?? "Não informado"}</dd>
          </div>
          <div>
            <dt>Maior salário</dt>
            <dd>{formatarSalario(concurso.salarioMaximo)}</dd>
          </div>
          <div>
            <dt>Inscrições</dt>
            <dd>{concurso.inscricaoTexto || "Não informadas"}</dd>
          </div>
          <div>
            <dt>Prazo final</dt>
            <dd>{formatarData(concurso.inscricaoFim)}</dd>
          </div>
          <div>
            <dt>Cargos</dt>
            <dd>{concurso.cargoResumo || "Não informado"}</dd>
          </div>
          <div>
            <dt>Escolaridades</dt>
            <dd>{concurso.escolaridades?.join(", ") || "Não informadas"}</dd>
          </div>
          <div>
            <dt>Seção PCI</dt>
            <dd>{concurso.secao || "Não informada"}</dd>
          </div>
          <div>
            <dt>Publicado em</dt>
            <dd>{formatarData(concurso.publicadoEm)}</dd>
          </div>
          <div>
            <dt>Coletado em</dt>
            <dd>{formatarData(concurso.coletadoEm)}</dd>
          </div>
          <div>
            <dt>Fonte</dt>
            <dd>{concurso.fonte || "PCI Concursos"}</dd>
          </div>
        </dl>

        <h3>Localidades identificadas</h3>
        {localidades.length > 0 ? (
          <ul className="lista-localidades">
            {localidades.map((localidade) => (
              <li key={`${localidade.codigoIbge}-${localidade.tipo}`}>
                <strong>
                  {localidade.cidade}/{localidade.uf}
                </strong>
                <span>
                  {localidade.tipo} · confiança {localidade.confianca}
                </span>
                {localidade.contexto && <small>{localidade.contexto}</small>}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma cidade foi identificada na notícia.</p>
        )}

        <a
          className="link-pci"
          href={concurso.urlPCI}
          target="_blank"
          rel="noreferrer"
        >
          Abrir link PCI Concursos
        </a>
      </section>
    </div>
  );
}

function App() {
  const [pontos, setPontos] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [concursos, setConcursos] = useState([]);
  const [erro, setErro] = useState(null);
  const [localizacaoUsuario, setLocalizacaoUsuario] = useState(null);
  const [centroMapa, setCentroMapa] = useState(null);
  const [notificacao, setNotificacao] = useState(null);
  const [cidadePesquisada, setCidadePesquisada] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [cidadeSelecionada, setCidadeSelecionada] = useState(null);
  const [detalheSelecionado, setDetalheSelecionado] = useState(null);
  const [distanciaRota, setDistanciaRota] = useState(null);
  const [calculandoRota, setCalculandoRota] = useState(false);
  const [erroRota, setErroRota] = useState(null);
  const [emTelaCheia, setEmTelaCheia] = useState(false);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const areaMapaRef = useRef(null);
  const cacheRotasRef = useRef(new Map());
  const solicitacaoRotaRef = useRef(0);
  const temporizadorNotificacaoRef = useRef(null);

  useEffect(() => {
    async function carregarDados() {
      try {
        const [respostaPontos, respostaMunicipios, respostaConcursos] = await Promise.all([
          fetch("/data/pontos-mapa.json"),
          fetch("/data/municipios.json"),
          fetch("/data/concursos.json"),
        ]);

        if (!respostaPontos.ok || !respostaMunicipios.ok || !respostaConcursos.ok) {
          throw new Error("Não foi possível carregar os dados do mapa.");
        }

        const [pontosCarregados, municipiosCarregados, concursosCarregados] = await Promise.all([
          respostaPontos.json(),
          respostaMunicipios.json(),
          respostaConcursos.json(),
        ]);

        setPontos(pontosCarregados);
        setMunicipios(municipiosCarregados);
        setConcursos(concursosCarregados);
      } catch (erroAtual) {
        setErro(erroAtual.message);
      }
    }

    carregarDados();
  }, []);

  useEffect(
    () => () => clearTimeout(temporizadorNotificacaoRef.current),
    [],
  );

  useEffect(() => {
    function atualizarTelaCheia() {
      setEmTelaCheia(document.fullscreenElement === areaMapaRef.current);
    }

    document.addEventListener("fullscreenchange", atualizarTelaCheia);

    return () => document.removeEventListener("fullscreenchange", atualizarTelaCheia);
  }, []);

  const concursosPorId = useMemo(
    () => new Map(concursos.map((concurso) => [concurso.id, concurso])),
    [concursos],
  );

  const sugestoesDeCidade = useMemo(() => {
    const busca = normalizarTexto(cidadePesquisada);

    if (busca.length < 2) return [];

    return municipios
      .filter((municipio) =>
        normalizarTexto(`${municipio.cidade} ${municipio.uf}`).includes(busca),
      )
      .slice(0, 10);
  }, [cidadePesquisada, municipios]);

  const pinsParaFiltrar = useMemo(
    () => pontos.flatMap((ponto) => ponto.concursos),
    [pontos],
  );

  const pinsFiltrados = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);

    return filtrarPinsMapa(pinsParaFiltrar, {
      latitude: centroMapa?.latitude,
      longitude: centroMapa?.longitude,
      distanciaMaximaKm:
        centroMapa && filtros.distanciaMaximaKm
          ? Number(filtros.distanciaMaximaKm)
          : undefined,
      uf: filtros.uf || undefined,
      status: filtros.status || undefined,
      tipoSelecao: filtros.tipoSelecao || undefined,
      inscricaoDe: filtros.inscricoesEmAndamento ? hoje : undefined,
      inscricaoAte: filtros.inscricaoAte || undefined,
    });
  }, [centroMapa, filtros, pinsParaFiltrar]);

  const pontosFiltrados = useMemo(
    () => agruparPinsPorMunicipio(pinsFiltrados),
    [pinsFiltrados],
  );

  const ufsDisponiveis = useMemo(
    () => [...new Set(pinsParaFiltrar.map((pin) => pin.uf))].sort(),
    [pinsParaFiltrar],
  );

  const filtrosAtivos =
    filtros.distanciaMaximaKm ||
    filtros.uf ||
    filtros.status ||
    filtros.tipoSelecao ||
    filtros.inscricoesEmAndamento ||
    filtros.inscricaoAte;

  const quantidadeFiltrosAtivos = [
    filtros.distanciaMaximaKm,
    filtros.uf,
    filtros.status,
    filtros.tipoSelecao,
    filtros.inscricoesEmAndamento,
    filtros.inscricaoAte,
  ].filter(Boolean).length;

  function alterarFiltro(campo, valor) {
    setFiltros((filtrosAtuais) => ({
      ...filtrosAtuais,
      [campo]: valor,
    }));
  }

  function mostrarNotificacao(mensagem) {
    clearTimeout(temporizadorNotificacaoRef.current);
    setNotificacao(mensagem);

    temporizadorNotificacaoRef.current = setTimeout(() => {
      setNotificacao(null);
    }, 5_000);
  }

  function usarMinhaLocalizacao() {
    if (!window.isSecureContext) {
      mostrarNotificacao(
        "A localização exige HTTPS neste celular. Use a busca por cidade durante este teste na rede local.",
      );
      return;
    }

    if (!navigator.geolocation) {
      mostrarNotificacao("Seu navegador não oferece suporte à geolocalização.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const novaLocalizacao = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        setLocalizacaoUsuario(novaLocalizacao);
        setCentroMapa(novaLocalizacao);
        setCidadeSelecionada(null);
        setNotificacao(null);
      },
      () => {
        mostrarNotificacao(
          "Não foi possível obter sua localização. Busque uma cidade para centralizar o mapa.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  function selecionarCidade(municipio) {
    setCidadePesquisada(`${municipio.cidade} - ${municipio.uf}`);
    setCentroMapa(municipio);
    setCidadeSelecionada(municipio);
    setMostrarSugestoes(false);
  }

  async function abrirDetalhes(pin) {
    const concurso = concursosPorId.get(pin.concursoId) ?? pin;
    const solicitacaoAtual = solicitacaoRotaRef.current + 1;

    solicitacaoRotaRef.current = solicitacaoAtual;
    setDetalheSelecionado({ concurso, destino: pin });
    setDistanciaRota(null);
    setErroRota(null);

    if (!centroMapa) {
      setCalculandoRota(false);
      return;
    }

    const chave = [
      centroMapa.latitude,
      centroMapa.longitude,
      pin.latitude,
      pin.longitude,
    ].join(":");

    const distanciaEmCache = cacheRotasRef.current.get(chave);

    if (distanciaEmCache !== undefined) {
      setCalculandoRota(false);
      setDistanciaRota(distanciaEmCache);
      return;
    }

    setCalculandoRota(true);

    try {
      const distancia = await calcularDistanciaPorRota({
        origem: centroMapa,
        destino: pin,
      });

      cacheRotasRef.current.set(chave, distancia);

      if (solicitacaoRotaRef.current === solicitacaoAtual) {
        setDistanciaRota(distancia);
      }
    } catch (erro) {
      if (solicitacaoRotaRef.current === solicitacaoAtual) {
        setErroRota(
          erro instanceof Error
            ? erro.message
            : "Não foi possível calcular a rota neste momento.",
        );
      }
    } finally {
      if (solicitacaoRotaRef.current === solicitacaoAtual) {
        setCalculandoRota(false);
      }
    }
  }

  async function alternarTelaCheia() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (!areaMapaRef.current?.requestFullscreen) {
        mostrarNotificacao("Seu navegador não oferece suporte ao modo de tela cheia.");
        return;
      }

      await areaMapaRef.current.requestFullscreen();
    } catch {
      mostrarNotificacao("Não foi possível ativar a tela cheia neste navegador.");
    }
  }

  return (
    <main className="app">
      <header className="cabecalho-principal">
        <div className="marca">
          <span className="marca-icone" aria-hidden="true">⌖</span>
          <div>
            <p className="sobretitulo">Mapa de Concursos</p>
            <h1>Oportunidades perto de você</h1>
          </div>
        </div>

        <div className="acoes-principais">
          <button
            className="botao-filtros"
            type="button"
            aria-expanded={filtrosAbertos}
            aria-label="Abrir filtros"
            onClick={() => setFiltrosAbertos(true)}
          >
            <span className="icone-menu" aria-hidden="true">☰</span>
            {quantidadeFiltrosAtivos > 0 && <span>{quantidadeFiltrosAtivos}</span>}
          </button>
        </div>
      </header>

      <section className="busca-principal" aria-label="Buscar cidade">
        <div className="busca-cidade">
          <label className="visualmente-oculto" htmlFor="cidade">Cidade e UF</label>
          <div>
            <input
              id="cidade"
              type="search"
              value={cidadePesquisada}
              onChange={({ target }) => {
                setCidadePesquisada(target.value);
                setMostrarSugestoes(true);
              }}
              onFocus={() => setMostrarSugestoes(true)}
              placeholder="Digite sua cidade (ex.: Capanema/PR)"
              autoComplete="off"
            />
          </div>
          {mostrarSugestoes && sugestoesDeCidade.length > 0 && (
            <ul className="sugestoes-cidade" role="listbox">
              {sugestoesDeCidade.map((municipio) => (
                <li key={municipio.codigoIbge}>
                  <button
                    type="button"
                    onMouseDown={(evento) => evento.preventDefault()}
                    onClick={() => selecionarCidade(municipio)}
                  >
                    {municipio.cidade} - {municipio.uf}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {filtrosAbertos && (
        <div className="sobreposicao-filtros" onMouseDown={() => setFiltrosAbertos(false)}>
          <aside
            className="gaveta-filtros"
            aria-labelledby="titulo-filtros"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="cabecalho-filtros">
              <div>
                <p className="sobretitulo">Refine sua busca</p>
                <h2 id="titulo-filtros">Filtros</h2>
              </div>
              <button
                className="botao-fechar-filtros"
                type="button"
                aria-label="Fechar filtros"
                onClick={() => setFiltrosAbertos(false)}
              >
                ×
              </button>
            </div>

            <div className="resumo-filtros" aria-live="polite">
              <strong>{pinsFiltrados.length} concursos</strong>
              <span>em {pontosFiltrados.length} municípios</span>
              {centroMapa && <small>Ordenados por distância em linha reta.</small>}
            </div>

            <div className="campos-filtros">
              <label>
                Raio de busca
                <select
                  value={filtros.distanciaMaximaKm}
                  disabled={!centroMapa}
                  onChange={({ target }) => alterarFiltro("distanciaMaximaKm", target.value)}
                >
                  <option value="">Sem limite</option>
                  <option value="25">Até 25 km</option>
                  <option value="50">Até 50 km</option>
                  <option value="100">Até 100 km</option>
                  <option value="250">Até 250 km</option>
                  <option value="500">Até 500 km</option>
                </select>
                {!centroMapa && <small>Defina uma origem para usar o raio.</small>}
              </label>

              <label>
                UF
                <select value={filtros.uf} onChange={({ target }) => alterarFiltro("uf", target.value)}>
                  <option value="">Todas as UFs</option>
                  {ufsDisponiveis.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </label>

              <label>
                Situação
                <select value={filtros.status} onChange={({ target }) => alterarFiltro("status", target.value)}>
                  <option value="">Todos os status</option>
                  <option value="aberto">Abertos</option>
                  <option value="encerrado">Encerrados</option>
                </select>
              </label>

              <label>
                Modalidade
                <select value={filtros.tipoSelecao} onChange={({ target }) => alterarFiltro("tipoSelecao", target.value)}>
                  <option value="">Todas as modalidades</option>
                  {Object.entries(ROTULOS_TIPO_SELECAO).map(([tipo, rotulo]) => (
                    <option key={tipo} value={tipo}>{rotulo}</option>
                  ))}
                </select>
              </label>

              <label>
                Prazo de inscrição até
                <input
                  type="date"
                  value={filtros.inscricaoAte}
                  onChange={({ target }) => alterarFiltro("inscricaoAte", target.value)}
                />
              </label>

              <label className="campo-checkbox">
                <input
                  type="checkbox"
                  checked={filtros.inscricoesEmAndamento}
                  onChange={({ target }) => alterarFiltro("inscricoesEmAndamento", target.checked)}
                />
                <span>Somente prazo de inscrição não encerrado</span>
              </label>
            </div>

            <div className="rodape-filtros">
              {filtrosAtivos && (
                <button className="botao-secundario" type="button" onClick={() => setFiltros(FILTROS_INICIAIS)}>
                  Limpar filtros
                </button>
              )}
              <button type="button" onClick={() => setFiltrosAbertos(false)}>
                Ver {pinsFiltrados.length} concursos
              </button>
            </div>
          </aside>
        </div>
      )}

      {erro ? (
        <p className="erro" role="alert">{erro}</p>
      ) : (
        <div className="area-mapa" ref={areaMapaRef}>
          {notificacao && (
            <p className="notificacao-mapa" role="status">
              {notificacao}
            </p>
          )}
          <button className="botao-tela-cheia" type="button" onClick={alternarTelaCheia}>
            {emTelaCheia ? "Sair da tela cheia" : "Tela cheia"}
          </button>
          <button
            className="botao-localizacao-mapa"
            type="button"
            title="Usar minha localização"
            aria-label="Usar minha localização"
            onClick={usarMinhaLocalizacao}
          >
            ⌖
          </button>
          <div className="busca-tela-cheia">
            <label className="visualmente-oculto" htmlFor="cidade-tela-cheia">Cidade e UF</label>
            <input
              id="cidade-tela-cheia"
              type="search"
              value={cidadePesquisada}
              onChange={({ target }) => {
                setCidadePesquisada(target.value);
                setMostrarSugestoes(true);
              }}
              onFocus={() => setMostrarSugestoes(true)}
              placeholder="Digite sua cidade (ex.: Capanema/PR)"
              autoComplete="off"
            />
            {mostrarSugestoes && sugestoesDeCidade.length > 0 && (
              <ul className="sugestoes-cidade" role="listbox">
                {sugestoesDeCidade.map((municipio) => (
                  <li key={municipio.codigoIbge}>
                    <button
                      type="button"
                      onMouseDown={(evento) => evento.preventDefault()}
                      onClick={() => selecionarCidade(municipio)}
                    >
                      {municipio.cidade} - {municipio.uf}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <MapContainer center={CENTRO_DO_BRASIL} zoom={4} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <RecentrarMapa localizacao={centroMapa} />

            {localizacaoUsuario && (
              <CircleMarker
                center={[localizacaoUsuario.latitude, localizacaoUsuario.longitude]}
                pathOptions={{ color: "#0b6e4f", fillColor: "#0b6e4f" }}
                radius={10}
              >
                <Popup>Sua localização aproximada</Popup>
              </CircleMarker>
            )}

            {cidadeSelecionada && (
              <CircleMarker
                center={[cidadeSelecionada.latitude, cidadeSelecionada.longitude]}
                pathOptions={{ color: "#b45309", fillColor: "#f59e0b", fillOpacity: 1 }}
                radius={12}
              >
                <Popup>Cidade selecionada: {cidadeSelecionada.cidade}/{cidadeSelecionada.uf}</Popup>
              </CircleMarker>
            )}

            {pontosFiltrados.map((ponto) => (
              <Marker key={ponto.codigoIbge} position={[ponto.latitude, ponto.longitude]}>
              <Popup minWidth={260} maxWidth={360} closeOnClick={false}>
                  <strong>{ponto.cidade}/{ponto.uf}</strong>
                  <p>{ponto.totalConcursos} concurso(s) encontrado(s)</p>
                  {ponto.distanciaKm !== null && (
                    <p className="distancia-em-linha-reta">
                      {ponto.distanciaKm.toFixed(1).replace(".", ",")} km em linha reta
                    </p>
                  )}
                  <ul className="lista-concursos">
                    {ponto.concursos.map((concurso) => (
                      <li key={concurso.id}>
                        <strong>{concurso.orgao}</strong>
                        <span>{concurso.titulo}</span>
                        <button
                          className="botao-detalhes"
                        type="button"
                        onMouseDown={(evento) => evento.stopPropagation()}
                        onClick={(evento) => {
                          evento.stopPropagation();
                          abrirDetalhes(concurso);
                        }}
                        >
                          Mais detalhes
                        </button>
                      </li>
                    ))}
                  </ul>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          {pontosFiltrados.length === 0 && (
            <p className="sem-resultados" role="status">
              Nenhum concurso encontrado com os filtros atuais.
            </p>
          )}
          <DetalhesConcurso
            concurso={detalheSelecionado?.concurso}
            destino={detalheSelecionado?.destino}
            distanciaRota={distanciaRota}
            calculandoRota={calculandoRota}
            erroRota={erroRota}
            possuiOrigem={centroMapa !== null}
            aoFechar={() => {
              solicitacaoRotaRef.current += 1;
              setDetalheSelecionado(null);
            }}
          />
        </div>
      )}
    </main>
  );
}

export default App;
