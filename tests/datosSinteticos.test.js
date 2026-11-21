/**
 * Semana 7 — Usa los datos sintéticos (tests/fixtures/datosSinteticos.js) con
 * `documentarCodigo`. Comprueba que los caracteres difíciles (tildes, ñ,
 * apóstrofo, emojis, comillas invertidas, \r\n) llegan intactos a la IA y que
 * el resultado conserva el código tal cual, sin cercas.
 */
const { documentarCodigo } = require('../src/documentador');
const { crearClienteFalso } = require('./ayudas');
const { CASOS_SINTETICOS } = require('./fixtures/datosSinteticos');

describe('documentarCodigo con datos sintéticos', () => {
  test('el fixture tiene al menos 8 casos y ningún código vacío', () => {
    expect(CASOS_SINTETICOS.length).toBeGreaterThanOrEqual(8);
    for (const caso of CASOS_SINTETICOS) {
      expect(caso.codigo.trim().length).toBeGreaterThan(0);
      expect(caso.jsdoc.startsWith('/**')).toBe(true);
    }
  });

  test.each(CASOS_SINTETICOS.map((caso) => [caso.nombre, caso]))('%s: se devuelve el código con su JSDoc', async (_n, caso) => {
    const respuestaIA = `${caso.jsdoc}\n${caso.codigo}`;
    const cliente = crearClienteFalso(respuestaIA);

    const resultado = await documentarCodigo(caso.codigo, cliente);

    expect(resultado).toBe(respuestaIA);
    expect(cliente.prompts[0]).toContain(`<<<INICIO_CODIGO>>>\n${caso.codigo}\n<<<FIN_CODIGO>>>`);
  });

  test.each(CASOS_SINTETICOS.map((caso) => [caso.nombre, caso]))('%s: también funciona si la IA envuelve la respuesta en una cerca', async (_n, caso) => {
    const cliente = crearClienteFalso('```javascript\n' + caso.jsdoc + '\n' + caso.codigo + '\n```');

    const resultado = await documentarCodigo(caso.codigo, cliente);

    expect(resultado).toBe(`${caso.jsdoc}\n${caso.codigo}`);
    expect(resultado.startsWith('```')).toBe(false);
  });
});
