/**
 * Dados iniciais de exemplo. Idempotente: cada registro só é inserido se ainda não existir
 * (missões por título, conquistas por nome, administrador por e-mail,
 * perguntas apenas em quizzes que ainda não têm nenhuma).
 */
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { xpDaMissao } = require('../utils/gameRules');

const MISSOES = [
  { titulo: 'Conheça a Biblioteca', descricao: 'Vá até a biblioteca e leia o QR Code fixado no balcão de atendimento.', dificuldade: 'Fácil', tipo: 'Tipo 1', qr_code: 'FATEC-BIBLIOTECA-001' },
  { titulo: 'Visite a Secretaria Acadêmica', descricao: 'Encontre o QR Code no mural da secretaria.', dificuldade: 'Fácil', tipo: 'Tipo 1', qr_code: 'FATEC-SECRETARIA-001' },
  { titulo: 'Explore o Laboratório de Informática', descricao: 'Localize o QR Code escondido no laboratório 3.', dificuldade: 'Médio', tipo: 'Tipo 1', qr_code: 'FATEC-LAB3-001' },
  { titulo: 'Quiz: Regimento da Fatec', descricao: 'Responda corretamente ao quiz sobre o regimento interno.', dificuldade: 'Médio', tipo: 'Tipo 2', qr_code: null },
  { titulo: 'Quiz: Lógica de Programação', descricao: 'Resolva os desafios de lógica propostos na plataforma.', dificuldade: 'Difícil', tipo: 'Tipo 2', qr_code: null },
  { titulo: 'Participe de uma Palestra', descricao: 'Leia o QR Code exibido ao final da palestra da semana.', dificuldade: 'Médio', tipo: 'Tipo 3', qr_code: 'FATEC-PALESTRA-001' },
  { titulo: 'Caça ao Tesouro no Campus', descricao: 'Siga as pistas pelo campus até o QR Code final.', dificuldade: 'Difícil', tipo: 'Tipo 3', qr_code: 'FATEC-TESOURO-001' },
  { titulo: 'Desafio Virtual: Portfólio', descricao: 'Publique seu portfólio e envie o link para validação.', dificuldade: 'Difícil', tipo: 'Tipo 4', qr_code: null },
];

const CONQUISTAS = [
  { nome: 'Primeiros Passos', descricao: 'Conclua sua primeira missão.', icone: '/icones/primeiros-passos.png', requisito: 'missoes:1' },
  { nome: 'Explorador', descricao: 'Conclua 5 missões.', icone: '/icones/explorador.png', requisito: 'missoes:5' },
  { nome: 'Veterano do Campus', descricao: 'Conclua 10 missões.', icone: '/icones/veterano.png', requisito: 'missoes:10' },
  { nome: 'Colecionador de XP', descricao: 'Acumule 500 de XP.', icone: '/icones/xp-500.png', requisito: 'xp:500' },
  { nome: 'Mestre do XP', descricao: 'Acumule 1000 de XP.', icone: '/icones/xp-1000.png', requisito: 'xp:1000' },
  { nome: 'Destemido', descricao: 'Conclua uma missão difícil.', icone: '/icones/destemido.png', requisito: 'dificuldade:Difícil:1' },
  { nome: 'Caçador de Desafios', descricao: 'Conclua 3 missões difíceis.', icone: '/icones/cacador.png', requisito: 'dificuldade:Difícil:3' },
  { nome: 'Pé na Estrada', descricao: 'Conclua 2 missões do Tipo 1.', icone: '/icones/pe-na-estrada.png', requisito: 'tipo:Tipo 1:2' },
];

// Perguntas de exemplo dos quizzes (a alternativa com correta: true é o gabarito).
// Quiz Médio (100 XP) / 4 perguntas = 25 XP cada · Quiz Difícil (150 XP) / 4 perguntas = 37,5 XP cada.
const PERGUNTAS = {
  'Quiz: Regimento da Fatec': [
    {
      enunciado: 'Qual instituição administra as Fatecs no estado de São Paulo?',
      alternativas: [
        { texto: 'Centro Paula Souza', correta: true },
        { texto: 'Ministério da Educação' },
        { texto: 'Universidade de São Paulo' },
        { texto: 'Prefeitura de cada município' },
      ],
    },
    {
      enunciado: 'O que significa a sigla FATEC?',
      alternativas: [
        { texto: 'Faculdade de Tecnologia', correta: true },
        { texto: 'Fundação de Apoio Técnico' },
        { texto: 'Faculdade Técnica Estadual de Ciências' },
        { texto: 'Federação Acadêmica de Tecnologia' },
      ],
    },
    {
      enunciado: 'Qual é a frequência mínima exigida para aprovação em uma disciplina?',
      alternativas: [
        { texto: '75%', correta: true },
        { texto: '50%' },
        { texto: '60%' },
        { texto: '90%' },
      ],
    },
    {
      enunciado: 'Qual sistema acadêmico on-line os alunos usam para consultar notas e faltas?',
      alternativas: [
        { texto: 'SIGA', correta: true },
        { texto: 'SISU' },
        { texto: 'ENEM' },
        { texto: 'FIES' },
      ],
    },
  ],
  'Quiz: Lógica de Programação': [
    {
      enunciado: 'Qual é o valor de (verdadeiro E falso) OU verdadeiro?',
      alternativas: [
        { texto: 'Verdadeiro', correta: true },
        { texto: 'Falso' },
        { texto: 'Indefinido' },
      ],
    },
    {
      enunciado: 'Quantas vezes o laço "para i de 0 até 9 passo 2" é executado?',
      alternativas: [
        { texto: '5', correta: true },
        { texto: '4' },
        { texto: '9' },
        { texto: '10' },
      ],
    },
    {
      enunciado: 'Qual estrutura de dados segue o princípio LIFO (último a entrar, primeiro a sair)?',
      alternativas: [
        { texto: 'Pilha', correta: true },
        { texto: 'Fila' },
        { texto: 'Lista ligada' },
        { texto: 'Árvore binária' },
      ],
    },
    {
      enunciado: 'Qual é o resultado de 17 % 5 (resto da divisão inteira)?',
      alternativas: [
        { texto: '2', correta: true },
        { texto: '3' },
        { texto: '3,4' },
        { texto: '0' },
      ],
    },
  ],
};

async function seedPerguntas(conn) {
  let total = 0;
  for (const [titulo, perguntas] of Object.entries(PERGUNTAS)) {
    const [[missao]] = await conn.query('SELECT missao_id FROM missao WHERE titulo = ?', [titulo]);
    if (!missao) continue;
    // Idempotente: só popula quizzes que ainda não têm nenhuma pergunta.
    const [[{ qtd }]] = await conn.query('SELECT COUNT(*) AS qtd FROM pergunta WHERE missao_id = ?', [missao.missao_id]);
    if (Number(qtd) > 0) continue;

    for (const [i, p] of perguntas.entries()) {
      const [r] = await conn.query('INSERT INTO pergunta (missao_id, enunciado, ordem) VALUES (?, ?, ?)', [
        missao.missao_id,
        p.enunciado,
        i + 1,
      ]);
      const valores = p.alternativas.map((a, j) => [r.insertId, a.texto, a.correta ? 1 : 0, j + 1]);
      await conn.query('INSERT INTO alternativa (pergunta_id, texto, correta, ordem) VALUES ?', [valores]);
      total++;
    }
  }
  return total;
}

async function seed(conn, log = console.log) {
  let missoes = 0;
  for (const m of MISSOES) {
    // XP sempre derivado da dificuldade (regra de negócio).
    const [r] = await conn.query(
      `INSERT INTO missao (titulo, descricao, dificuldade, tipo, xp, status, qr_code)
       SELECT ?, ?, ?, ?, ?, 'ativa', ? FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM missao WHERE titulo = ?)`,
      [m.titulo, m.descricao, m.dificuldade, m.tipo, xpDaMissao(m.dificuldade), m.qr_code, m.titulo]
    );
    missoes += r.affectedRows;
  }

  let conquistas = 0;
  for (const c of CONQUISTAS) {
    const [r] = await conn.query(
      `INSERT INTO conquista (nome, descricao, icone, requisito)
       SELECT ?, ?, ?, ? FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM conquista WHERE nome = ?)`,
      [c.nome, c.descricao, c.icone, c.requisito, c.nome]
    );
    conquistas += r.affectedRows;
  }

  let admin = 0;
  if (env.admin.email && env.admin.senha) {
    const hash = await bcrypt.hash(env.admin.senha, env.bcryptSaltRounds);
    // INSERT IGNORE: não sobrescreve se o e-mail já existir (UNIQUE).
    const [r] = await conn.query(
      `INSERT IGNORE INTO usuario (nome, email, senha_hash, curso, semestre, role)
       VALUES (?, ?, ?, 'Administração do Sistema', 1, 'administrador')`,
      [env.admin.nome, env.admin.email.toLowerCase(), hash]
    );
    admin = r.affectedRows;
  }

  const perguntas = await seedPerguntas(conn);

  log(
    `[seed] Inseridos: ${missoes} missões, ${perguntas} perguntas de quiz, ` +
      `${conquistas} conquistas, ${admin} administrador(es).`
  );
}

module.exports = { seed, MISSOES, CONQUISTAS, PERGUNTAS };
