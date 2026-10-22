/**
 * Geração de CSV compatível com o Excel em português:
 * - separador ";" (o Excel pt-BR usa vírgula como separador decimal);
 * - BOM UTF-8 para os acentos abrirem corretamente;
 * - quebras de linha CRLF;
 * - aspas duplas escapadas.
 *
 * Proteção contra "CSV injection": células de texto que começam com = + - @ (ou TAB/CR)
 * podem ser interpretadas como fórmula pelo Excel; recebem um apóstrofo na frente.
 */
const SEPARADOR = ';';
const BOM = '﻿';

function celula(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  let texto = String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * @param {Array<{chave: string, titulo: string}>} colunas
 * @param {Array<object>} linhas
 */
function gerarCsv(colunas, linhas) {
  const cabecalho = colunas.map((c) => celula(c.titulo)).join(SEPARADOR);
  const corpo = linhas.map((l) => colunas.map((c) => celula(l[c.chave])).join(SEPARADOR));
  return BOM + [cabecalho, ...corpo].join('\r\n') + '\r\n';
}

module.exports = { gerarCsv, celula };
