/**
 * Ayudas compartidas por las pruebas de la semana 7. No es un archivo de pruebas.
 */

/** Bloque JSDoc mínimo que usan las respuestas «buenas» de la IA falsa. */
const JSDOC_BASICO = '/**\n * Documentación de prueba.\n */';

/**
 * Cliente de IA falso: responde lo indicado y guarda los prompts recibidos.
 * @param {*} respuesta Valor que devolverá `generar`.
 * @returns {{ generar: Function, prompts: string[] }}
 */
function crearClienteFalso(respuesta) {
  const prompts = [];
  return {
    prompts,
    generar: async (prompt) => {
      prompts.push(prompt);
      return respuesta;
    },
  };
}

/**
 * Espera una promesa que debe fallar y devuelve el error, para poder comprobar
 * su tipo EXACTO (constructor) y su mensaje completo.
 * @param {Promise<*>} promesa Promesa que se espera rechazada.
 * @returns {Promise<Error>} El error con el que se rechazó.
 * @throws {Error} Si la promesa NO fue rechazada.
 */
async function capturarError(promesa) {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba que la promesa fallara, pero se resolvió');
}

/**
 * Igual que `capturarError` pero para funciones síncronas.
 * @param {Function} funcion Función que debe lanzar.
 * @returns {Error} El error lanzado.
 * @throws {Error} Si la función NO lanzó.
 */
function capturarErrorSincrono(funcion) {
  try {
    funcion();
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba que la función lanzara un error, pero terminó bien');
}

module.exports = { JSDOC_BASICO, crearClienteFalso, capturarError, capturarErrorSincrono };
