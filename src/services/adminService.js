const dashboardModel = require('../models/dashboardModel');
const usuarioModel = require('../models/usuarioModel');
const { gerarCsv } = require('../utils/csv');

const percentual = (parte, total) => (total > 0 ? Math.round((parte / total) * 10000) / 100 : 0);
const n = (v) => Number(v) || 0;

/**
 * Indicadores gerais do painel administrativo.
 * - usuarios.ativos: estudantes com ao menos uma tentativa registrada (o modelo não guarda datas
 *   de acesso, então "ativo" = já participou de alguma missão).
 * - taxa_acerto: % das tentativas que foram sucesso.
 * - taxa_conclusao: % dos pares possíveis (estudante × missão ativa) já concluídos.
 */
async function dashboard() {
  const [ind, top, realizadas, cursos] = await Promise.all([
    dashboardModel.indicadores(),
    dashboardModel.missoesMaisConcluidas(5),
    dashboardModel.missoesRealizadas(),
    dashboardModel.participacaoPorCurso(),
  ]);

  const totalTentativas = n(ind.total_tentativas);
  const totalSucessos = n(ind.total_sucessos);
  const estudantes = n(ind.total_estudantes);
  const paresPossiveis = estudantes * n(ind.missoes_ativas);

  return {
    usuarios: {
      total: n(ind.total_usuarios),
      estudantes,
      administradores: n(ind.total_administradores),
      ativos: n(ind.estudantes_ativos),
      percentual_ativos: percentual(n(ind.estudantes_ativos), estudantes),
    },
    missoes: {
      total: n(ind.total_missoes),
      ativas: n(ind.missoes_ativas),
      inativas: n(ind.total_missoes) - n(ind.missoes_ativas),
    },
    xp: {
      distribuido: n(ind.xp_distribuido),
      penalidades: n(ind.xp_penalidades),
      saldo: n(ind.xp_distribuido) + n(ind.xp_penalidades),
    },
    tentativas: {
      total: totalTentativas,
      sucessos: totalSucessos,
      erros: totalTentativas - totalSucessos,
      taxa_acerto: percentual(totalSucessos, totalTentativas),
    },
    conclusoes: totalSucessos,
    taxa_conclusao: percentual(n(ind.conclusoes_missoes_ativas), paresPossiveis),
    conquistas_desbloqueadas: n(ind.conquistas_desbloqueadas),
    missoes_mais_concluidas: top.map((m) => ({ ...m, conclusoes: n(m.conclusoes) })),
    missoes_realizadas: realizadas.map((m) => ({
      ...m,
      conclusoes: n(m.conclusoes),
      erros: n(m.erros),
      tentativas: n(m.tentativas),
    })),
    participacao_por_curso: cursos.map((c) => ({
      curso: c.curso,
      estudantes: n(c.estudantes),
      ativos: n(c.ativos),
      percentual_ativos: percentual(n(c.ativos), n(c.estudantes)),
      conclusoes: n(c.conclusoes),
      xp_total: n(c.xp_total),
    })),
  };
}

const COLUNAS_USUARIOS = [
  { chave: 'usuario_id', titulo: 'ID' },
  { chave: 'nome', titulo: 'Nome' },
  { chave: 'email', titulo: 'E-mail' },
  { chave: 'curso', titulo: 'Curso' },
  { chave: 'semestre', titulo: 'Semestre' },
  { chave: 'role', titulo: 'Perfil' },
  { chave: 'xp', titulo: 'XP' },
  { chave: 'missoes_concluidas', titulo: 'Missões concluídas' },
  { chave: 'tentativas', titulo: 'Tentativas' },
  { chave: 'erros', titulo: 'Erros' },
  { chave: 'conquistas', titulo: 'Conquistas' },
];

/** Todos os usuários cadastrados com estatísticas (JSON). */
async function listarUsuarios() {
  return usuarioModel.listarComEstatisticas();
}

/** Mesmos dados em CSV (separador ";", UTF-8 com BOM) para abrir no Excel. */
async function exportarUsuariosCsv() {
  return gerarCsv(COLUNAS_USUARIOS, await usuarioModel.listarComEstatisticas());
}

module.exports = { dashboard, listarUsuarios, exportarUsuariosCsv };
