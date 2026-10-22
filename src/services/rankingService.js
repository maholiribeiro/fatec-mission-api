const rankingModel = require('../models/rankingModel');

/**
 * Ranking = consulta ORDER BY xp DESC (nunca armazenado).
 * Posições no padrão "competição": empatados dividem a posição (1, 2, 2, 4...).
 */
async function obter({ curso, limite, pagina }) {
  const [usuarios, total] = await Promise.all([
    rankingModel.listar({ curso, limite, pagina }),
    rankingModel.contar(curso),
  ]);

  const offset = (pagina - 1) * limite;
  let posicaoAnterior = 0;
  const itens = [];

  for (let i = 0; i < usuarios.length; i++) {
    const u = usuarios[i];
    let posicao;
    if (i > 0 && u.xp === usuarios[i - 1].xp) {
      posicao = posicaoAnterior;
    } else if (i === 0 && offset > 0) {
      // Primeiro item de uma página > 1: pode estar empatado com alguém da página anterior.
      posicao = (await rankingModel.contarComXpMaior(u.xp, curso)) + 1;
    } else {
      posicao = offset + i + 1;
    }
    posicaoAnterior = posicao;
    itens.push({ posicao, ...u });
  }

  return { curso: curso || null, pagina, limite, total, ranking: itens };
}

module.exports = { obter };
