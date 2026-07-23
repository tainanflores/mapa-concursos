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

const CENTRO_DO_BRASIL = [-14.235, -51.9253];

const ROTULOS_TIPO_SELECAO = {
  concurso_publico: "Concurso público",
  processo_seletivo: "Processo seletivo",
  selecao_publica: "Seleção pública",
  misto: "Concurso e processo seletivo",
  indefinido: "Não informado",
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

function RecentrarMapa({ localizacao }) {
  const mapa = useMap();

  useEffect(() => {
    if (localizacao) {
      mapa.setView([localizacao.latitude, localizacao.longitude], 10);
    }
  }, [localizacao, mapa]);

  return null;
}

function DetalhesConcurso({ concurso, aoFechar }) {
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
          <button className="fechar-detalhes" type="button" onClick={aoFechar}>
            Fechar ×
          </button>
          <p className="sobretitulo">Detalhes do concurso</p>
          <h2 id="titulo-detalhes">{concurso.titulo}</h2>
        </div>
        <p className="orgao">{concurso.orgao}</p>

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
  const [mensagemLocalizacao, setMensagemLocalizacao] = useState(null);
  const [cidadePesquisada, setCidadePesquisada] = useState("");
  const [mensagemBusca, setMensagemBusca] = useState(null);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [cidadeSelecionada, setCidadeSelecionada] = useState(null);
  const [concursoSelecionado, setConcursoSelecionado] = useState(null);
  const [emTelaCheia, setEmTelaCheia] = useState(false);
  const areaMapaRef = useRef(null);

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

  function usarMinhaLocalizacao() {
    if (!window.isSecureContext) {
      setMensagemLocalizacao(
        "A localização exige HTTPS neste celular. Use a busca por cidade durante este teste na rede local.",
      );
      return;
    }

    if (!navigator.geolocation) {
      setMensagemLocalizacao("Seu navegador não oferece suporte à geolocalização.");
      return;
    }

    setMensagemLocalizacao("Obtendo sua localização...");

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const novaLocalizacao = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        setLocalizacaoUsuario(novaLocalizacao);
        setCentroMapa(novaLocalizacao);
        setCidadeSelecionada(null);
        setMensagemLocalizacao("Mapa centralizado na sua localização.");
      },
      () => {
        setMensagemLocalizacao(
          "Não foi possível obter sua localização. Busque uma cidade para centralizar o mapa.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  function buscarCidade(evento) {
    evento.preventDefault();

    if (sugestoesDeCidade.length === 0) {
      setMensagemBusca("Cidade não encontrada. Informe o nome e a UF, por exemplo: Capanema - PR.");
      return;
    }

    const cidade = sugestoesDeCidade[0];
    setCentroMapa(cidade);
    setCidadeSelecionada(cidade);
    setCidadePesquisada(`${cidade.cidade} - ${cidade.uf}`);
    setMostrarSugestoes(false);
    setMensagemBusca(`Mapa centralizado em ${cidade.cidade}/${cidade.uf}.`);
  }

  function selecionarCidade(municipio) {
    setCidadePesquisada(`${municipio.cidade} - ${municipio.uf}`);
    setCentroMapa(municipio);
    setCidadeSelecionada(municipio);
    setMensagemBusca(`Mapa centralizado em ${municipio.cidade}/${municipio.uf}.`);
    setMostrarSugestoes(false);
  }

  async function alternarTelaCheia() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (!areaMapaRef.current?.requestFullscreen) {
        setMensagemBusca("Seu navegador não oferece suporte ao modo de tela cheia.");
        return;
      }

      await areaMapaRef.current.requestFullscreen();
    } catch {
      setMensagemBusca("Não foi possível ativar a tela cheia neste navegador.");
    }
  }

  return (
    <main>
      <header>
        <div>
          <p className="sobretitulo">Mapa de Concursos</p>
          <h1>Concursos próximos de você</h1>
          <p>{pontos.length} municípios com oportunidades localizadas.</p>
        </div>

        <div className="acoes-localizacao">
          <button type="button" onClick={usarMinhaLocalizacao}>
            Usar minha localização
          </button>
          <form className="busca-cidade" onSubmit={buscarCidade}>
            <label htmlFor="cidade">ou busque uma cidade</label>
            <div>
              <input
                id="cidade"
                type="search"
                value={cidadePesquisada}
                onChange={({ target }) => {
                  setCidadePesquisada(target.value);
                  setMensagemBusca(null);
                  setMostrarSugestoes(true);
                }}
                onFocus={() => setMostrarSugestoes(true)}
                placeholder="Ex.: Capanema - PR"
                autoComplete="off"
              />
              <button type="submit">Buscar</button>
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
          </form>
        </div>
      </header>

      {mensagemLocalizacao && <p className="mensagem" role="status">{mensagemLocalizacao}</p>}
      {mensagemBusca && <p className="mensagem" role="status">{mensagemBusca}</p>}

      {erro ? (
        <p className="erro" role="alert">{erro}</p>
      ) : (
        <div className="area-mapa" ref={areaMapaRef}>
          <button className="botao-tela-cheia" type="button" onClick={alternarTelaCheia}>
            {emTelaCheia ? "Sair da tela cheia" : "Tela cheia"}
          </button>
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

            {pontos.map((ponto) => (
              <Marker key={ponto.codigoIbge} position={[ponto.latitude, ponto.longitude]}>
              <Popup minWidth={260} closeOnClick={false}>
                  <strong>{ponto.cidade}/{ponto.uf}</strong>
                  <p>{ponto.totalConcursos} concurso(s) encontrado(s)</p>
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
                            setConcursoSelecionado(
                              concursosPorId.get(concurso.concursoId) ?? concurso,
                            );
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
          <DetalhesConcurso
            concurso={concursoSelecionado}
            aoFechar={() => setConcursoSelecionado(null)}
          />
        </div>
      )}
    </main>
  );
}

export default App;
