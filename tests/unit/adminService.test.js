jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/models/dashboardModel');
jest.mock('../../src/models/usuarioModel');

const dashboardModel = require('../../src/models/dashboardModel');
const usuarioModel = require('../../src/models/usuarioModel');
const adminService = require('../../src/services/adminService');
const { gerarCsv, celula } = require('../../src/utils/csv');

beforeEach(() => jest.resetAllMocks());

describe('adminService.dashboard', () => {
  test('calcula ativos, conclusões, taxas e converte números vindos do MySQL', async () => {
    dashboardModel.indicadores.mockResolvedValue({
      total_usuarios: 11, total_estudantes: 10, total_administradores: 1, estudantes_ativos: 4,
      total_missoes: 5, missoes_ativas: 4, xp_distribuido: '900', xp_penalidades: '-100',
      total_tentativas: 12, total_sucessos: 9, conclusoes_missoes_ativas: 8, conquistas_desbloqueadas: 3,
    });
    dashboardModel.missoesMaisConcluidas.mockResolvedValue([]);
    dashboardModel.missoesRealizadas.mockResolvedValue([
      { missao_id: 1, titulo: 'A', conclusoes: '5', erros: '1', tentativas: '6' },
      { missao_id: 2, titulo: 'B', conclusoes: '0', erros: '0', tentativas: '0' },
    ]);
    dashboardModel.participacaoPorCurso.mockResolvedValue([
      { curso: 'ADS', estudantes: 6, ativos: '3', conclusoes: '7', xp_total: '700' },
    ]);

    const d = await adminService.dashboard();

    expect(d.usuarios).toMatchObject({ estudantes: 10, ativos: 4, percentual_ativos: 40 });
    expect(d.conclusoes).toBe(9);
    expect(d.xp).toEqual({ distribuido: 900, penalidades: -100, saldo: 800 });
    expect(d.taxa_conclusao).toBe(20); // 8 / (10 × 4)
    expect(d.missoes_realizadas[0]).toMatchObject({ conclusoes: 5, tentativas: 6 });
    expect(d.missoes_realizadas).toHaveLength(2); // inclui missões nunca realizadas
    expect(d.participacao_por_curso[0]).toEqual({
      curso: 'ADS', estudantes: 6, ativos: 3, percentual_ativos: 50, conclusoes: 7, xp_total: 700,
    });
  });

  test('sem estudantes não divide por zero', async () => {
    dashboardModel.indicadores.mockResolvedValue({});
    dashboardModel.missoesMaisConcluidas.mockResolvedValue([]);
    dashboardModel.missoesRealizadas.mockResolvedValue([]);
    dashboardModel.participacaoPorCurso.mockResolvedValue([]);
    const d = await adminService.dashboard();
    expect(d.taxa_conclusao).toBe(0);
    expect(d.usuarios.percentual_ativos).toBe(0);
  });
});

describe('exportação CSV de usuários', () => {
  test('cabeçalho em português, separador ";" e BOM para o Excel', async () => {
    usuarioModel.listarComEstatisticas.mockResolvedValue([
      { usuario_id: 7, nome: 'Maria Souza', email: 'maria@x.com', curso: 'ADS', semestre: 3, role: 'estudante', xp: 325, missoes_concluidas: 3, tentativas: 4, erros: 1, conquistas: 2 },
    ]);
    const csv = await adminService.exportarUsuariosCsv();
    expect(csv.startsWith('﻿')).toBe(true);
    const [cab, linha] = csv.slice(1).split('\r\n');
    expect(cab).toBe('ID;Nome;E-mail;Curso;Semestre;Perfil;XP;Missões concluídas;Tentativas;Erros;Conquistas');
    expect(linha).toBe('7;Maria Souza;maria@x.com;ADS;3;estudante;325;3;4;1;2');
  });

  test('escapa aspas, separador e quebras de linha', () => {
    expect(celula('Silva; "Jr"')).toBe('"Silva; ""Jr"""');
    expect(celula('linha\nnova')).toBe('"linha\nnova"');
    expect(celula(null)).toBe('');
    expect(celula(0)).toBe('0');
  });

  test('neutraliza fórmulas (CSV injection)', () => {
    expect(celula('=HYPERLINK("http://mal")')).toBe('"\'=HYPERLINK(""http://mal"")"');
    expect(celula('+55 11')).toBe("'+55 11");
    expect(celula('@SOMA')).toBe("'@SOMA");
    expect(celula(-15)).toBe('-15'); // números negativos continuam números
  });

  test('gera uma linha por registro', () => {
    const csv = gerarCsv([{ chave: 'a', titulo: 'A' }], [{ a: 1 }, { a: 2 }]);
    expect(csv).toBe('﻿A\r\n1\r\n2\r\n');
  });
});
