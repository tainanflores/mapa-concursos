import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createClient } from "@supabase/supabase-js";

const ARQUIVO_CONCURSOS = "public/data/concursos.json";
const ARQUIVO_PONTOS = "public/data/pontos-mapa.json";

function distanciaEmKm(origem, destino) {
  const raioTerra = 6371;
  const paraRadianos = (valor) => (valor * Math.PI) / 180;
  const deltaLatitude = paraRadianos(destino.latitude - origem.latitude);
  const deltaLongitude = paraRadianos(destino.longitude - origem.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(paraRadianos(origem.latitude))
    * Math.cos(paraRadianos(destino.latitude))
    * Math.sin(deltaLongitude / 2) ** 2;

  return raioTerra * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function lerJsonDoUltimoCommit(caminho) {
  try {
    return JSON.parse(execFileSync("git", ["show", `HEAD:${caminho}`], { encoding: "utf8" }));
  } catch {
    return [];
  }
}

function agruparPontosPorConcurso(pontos) {
  const porConcurso = new Map();

  for (const ponto of pontos) {
    for (const concurso of ponto.concursos ?? []) {
      const localidades = porConcurso.get(concurso.concursoId) ?? [];
      localidades.push({
        codigoIbge: ponto.codigoIbge,
        latitude: ponto.latitude,
        longitude: ponto.longitude,
        uf: ponto.uf,
      });
      porConcurso.set(concurso.concursoId, localidades);
    }
  }

  return porConcurso;
}

function correspondeAoAlerta(concurso, localidades, criterios) {
  if (criterios?.abrangencia === "nacional") return true;
  if (criterios?.abrangencia === "uf") {
    return localidades.some((localidade) => localidade.uf === criterios.uf) || concurso.uf === criterios.uf;
  }
  if (criterios?.abrangencia === "cidade") {
    return localidades.some((localidade) => localidade.codigoIbge === criterios.codigoIbge);
  }
  if (criterios?.abrangencia === "raio") {
    return localidades.some((localidade) => distanciaEmKm(criterios.origem, localidade) <= criterios.raioKm);
  }
  return false;
}

function resumoNotificacao(concursos) {
  if (concursos.length === 1) {
    return { title: "Novo concurso encontrado", body: concursos[0].titulo || concursos[0].orgao };
  }
  return {
    title: `${concursos.length} novos concursos encontrados`,
    body: concursos.slice(0, 2).map((concurso) => concurso.orgao).join(" · "),
  };
}

async function enviarNotificacaoDeTeste(supabase, messaging) {
  const { data: dispositivos, error } = await supabase
    .from("dispositivos")
    .select("token_push")
    .eq("ativo", true)
    .eq("plataforma", "android");

  if (error) throw error;

  const tokens = [...new Set((dispositivos ?? []).map((dispositivo) => dispositivo.token_push))];
  if (tokens.length === 0) {
    console.log("Nenhum aparelho Android ativo encontrado para a notificação de teste.");
    return;
  }

  const concursoDeTeste = JSON.parse(readFileSync(ARQUIVO_CONCURSOS, "utf8"))
    .find((concurso) => concurso.status === "aberto");

  const resultado = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: "Notificações ativadas",
      body: "Toque para testar a abertura de um concurso no Mapa de Concursos.",
    },
    data: concursoDeTeste
      ? { tipo: "novo_concurso", concursoIds: concursoDeTeste.id }
      : { tipo: "teste_notificacao" },
    android: { priority: "high", notification: { channelId: "fcm_fallback_notification_channel" } },
  });

  if (resultado.failureCount > 0) {
    const falhas = resultado.responses
      .filter((resposta) => !resposta.success)
      .map((resposta) => resposta.error?.code ?? "erro-desconhecido");
    console.log(`Teste enviado para ${resultado.successCount} dispositivo(s); ${resultado.failureCount} falha(s): ${falhas.join(", ")}`);
    return;
  }

  console.log(`Notificação de teste enviada para ${resultado.successCount} dispositivo(s).`);
}

async function executar() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const credenciaisFirebase = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!url || !chave || !credenciaisFirebase) {
    console.log("Alertas ignorados: Secrets administrativos não configurados.");
    return;
  }

  const supabase = createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });
  const credenciais = JSON.parse(credenciaisFirebase);
  if (getApps().length === 0) initializeApp({ credential: cert(credenciais) });
  const messaging = getMessaging();

  if (process.env.ENVIAR_ALERTA_TESTE === "true") {
    await enviarNotificacaoDeTeste(supabase, messaging);
    return;
  }

  const atuais = JSON.parse(readFileSync(ARQUIVO_CONCURSOS, "utf8"));
  const anteriores = lerJsonDoUltimoCommit(ARQUIVO_CONCURSOS);
  const idsAnteriores = new Set(anteriores.map((concurso) => concurso.id));
  const novos = atuais.filter((concurso) => !idsAnteriores.has(concurso.id) && concurso.status === "aberto");

  if (novos.length === 0) {
    console.log("Nenhum concurso aberto novo para notificar.");
    return;
  }

  const pontos = JSON.parse(readFileSync(ARQUIVO_PONTOS, "utf8"));
  const localidadesPorConcurso = agruparPontosPorConcurso(pontos);
  const [{ data: alertas, error: erroAlertas }, { data: dispositivos, error: erroDispositivos }] = await Promise.all([
    supabase.from("alertas").select("id, usuario_id, criterios").eq("ativo", true),
    supabase.from("dispositivos").select("usuario_id, token_push").eq("ativo", true).eq("plataforma", "android"),
  ]);

  if (erroAlertas) throw erroAlertas;
  if (erroDispositivos) throw erroDispositivos;

  const dispositivosPorUsuario = new Map();
  for (const dispositivo of dispositivos ?? []) {
    const tokens = dispositivosPorUsuario.get(dispositivo.usuario_id) ?? [];
    tokens.push(dispositivo.token_push);
    dispositivosPorUsuario.set(dispositivo.usuario_id, tokens);
  }

  let totalEnvios = 0;

  for (const alerta of alertas ?? []) {
    const tokens = dispositivosPorUsuario.get(alerta.usuario_id) ?? [];
    if (tokens.length === 0) continue;

    const candidatos = novos.filter((concurso) => correspondeAoAlerta(
      concurso,
      localidadesPorConcurso.get(concurso.id) ?? [],
      alerta.criterios,
    ));
    if (candidatos.length === 0) continue;

    const { data: enviados, error: erroEnviados } = await supabase
      .from("envios_notificacao")
      .select("concurso_id")
      .eq("usuario_id", alerta.usuario_id)
      .eq("alerta_id", alerta.id)
      .eq("tipo", "novo_concurso")
      .in("concurso_id", candidatos.map((concurso) => concurso.id));
    if (erroEnviados) throw erroEnviados;

    const idsEnviados = new Set((enviados ?? []).map((envio) => envio.concurso_id));
    const pendentes = candidatos.filter((concurso) => !idsEnviados.has(concurso.id));
    if (pendentes.length === 0) continue;

    const mensagem = resumoNotificacao(pendentes);
    const resultado = await messaging.sendEachForMulticast({
      tokens,
      notification: mensagem,
      data: {
        tipo: "novo_concurso",
        alertaId: alerta.id,
        // Dados do FCM são limitados. Dez oportunidades cobrem o caso usual
        // de uma atualização diária sem comprometer a abertura no aplicativo.
        concursoIds: pendentes.slice(0, 10).map((concurso) => concurso.id).join("|"),
      },
      android: { priority: "high", notification: { channelId: "fcm_fallback_notification_channel" } },
    });

    if (resultado.successCount === 0) continue;
    const { error: erroRegistro } = await supabase.from("envios_notificacao").upsert(
      pendentes.map((concurso) => ({ usuario_id: alerta.usuario_id, concurso_id: concurso.id, alerta_id: alerta.id, tipo: "novo_concurso" })),
      { onConflict: "usuario_id,concurso_id,alerta_id,tipo" },
    );
    if (erroRegistro) throw erroRegistro;
    totalEnvios += resultado.successCount;
  }

  console.log(`Alertas enviados para ${totalEnvios} dispositivo(s).`);
}

executar().catch((erro) => {
  console.error("Falha ao enviar alertas:", erro);
  process.exitCode = 1;
});
