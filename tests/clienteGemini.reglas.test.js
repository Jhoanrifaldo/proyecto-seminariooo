/**
 * Semana 7 — Pruebas de reglas de `crearClienteGemini` y de su método `generar`.
 * Los esperados salen de las reglas de registro_pruebas.md (sección 1) y de la
 * documentación del módulo; no se calculan ejecutando el código.
 */
const { crearClienteGemini } = require('../src/clienteGemini');
const { capturarError, capturarErrorSincrono } = require('./ayudas');

const MSG_SIN_CLAVE = 'Falta la variable de entorno GEMINI_API_KEY (copia .env.example como .env)';
const MSG_MODELO = 'El nombre del modelo de Gemini no es válido';
const MSG_FORMATO = 'Respuesta de Gemini con formato inesperado';

/**
 * Fetch falso que se comporta como el real: `ok` es verdadero solo con estados 200–299.
 * @param {{ status?: number, cuerpo?: * }} config Respuesta simulada.
 * @returns {Function & { llamadas: Array<[string, object]> }}
 */
function crearFetchFalso({ status = 200, cuerpo = {} } = {}) {
  const llamadas = [];
  const fetchFalso = async (url, opciones) => {
    llamadas.push([url, opciones]);
    return { ok: status >= 200 && status <= 299, status, json: async () => cuerpo };
  };
  fetchFalso.llamadas = llamadas;
  return fetchFalso;
}

const conTexto = (...textos) => ({ candidates: [{ content: { parts: textos.map((text) => ({ text })) } }] });

describe('crearClienteGemini — validación de la configuración', () => {
  describe('Partición: clave de API', () => {
    test.each([
      // [descripción, apiKey]
      ['cadena vacía', ''],
      ['undefined', undefined],
      ['null', null],
    ])('sin clave (%s) lanza error que nombra GEMINI_API_KEY', (_d, apiKey) => {
      const error = capturarErrorSincrono(() => crearClienteGemini({ apiKey, modelo: 'gemini-x', fetch: crearFetchFalso() }));

      expect(error.constructor).toBe(Error);
      expect(error.message).toBe(MSG_SIN_CLAVE);
    });

    test('una clave de 1 carácter (primer valor aceptado) crea el cliente', () => {
      const cliente = crearClienteGemini({ apiKey: 'k', modelo: 'm', fetch: crearFetchFalso() });

      expect(typeof cliente.generar).toBe('function');
    });
  });

  describe('Partición: nombre del modelo (solo letras, números, punto, guion y guion bajo)', () => {
    test.each([
      // [descripción, modelo]
      ['1 carácter (primer valor aceptado)', 'a'],
      ['modelo por defecto de Gemini', 'gemini-2.5-flash'],
      ['con guion bajo', 'gemini_pro'],
      ['solo números', '2025'],
    ])('modelo válido: %s', (_d, modelo) => {
      expect(() => crearClienteGemini({ apiKey: 'k', modelo, fetch: crearFetchFalso() })).not.toThrow();
    });

    test.each([
      // [descripción, modelo]
      ['0 caracteres (límite inferior)', ''],
      ['con espacio', 'gemini 2'],
      ['con barra (cambiaría la ruta)', 'a/b'],
      ['con recorrido de carpetas', '../../otra-ruta'],
      ['con signo de pregunta (agrega parámetros)', 'gemini?x=1'],
      ['con dos puntos (cambia la acción)', 'gemini:otraAccion'],
      ['con salto de línea', 'gemini\nx'],
      ['con tilde', 'géminis'],
    ])('modelo inválido: %s', (_d, modelo) => {
      const error = capturarErrorSincrono(() => crearClienteGemini({ apiKey: 'k', modelo, fetch: crearFetchFalso() }));

      expect(error.constructor).toBe(Error);
      expect(error.message).toBe(MSG_MODELO);
    });
  });

  describe('Tabla de decisión: clave × modelo', () => {
    // R1 (ambas bien), R2 (solo falla la clave) y R3 (solo falla el modelo) ya las cubren las
    // particiones de arriba. Aquí queda la única combinación que no cubren: R4, fallan las dos.
    test('R4 — sin clave y con modelo inválido: lanza error (no se define cuál va primero)', () => {
      const crear = () => crearClienteGemini({ apiKey: '', modelo: '../x', fetch: crearFetchFalso() });

      expect(crear).toThrow(Error);
    });
  });

  describe('Valores por defecto (leídos de las variables de entorno)', () => {
    const ENTORNO_ORIGINAL = { ...process.env };
    afterEach(() => {
      process.env = { ...ENTORNO_ORIGINAL };
    });

    test('sin modelo ni GEMINI_MODELO usa gemini-2.5-flash en la URL', async () => {
      delete process.env.GEMINI_MODELO;
      const fetchFalso = crearFetchFalso({ cuerpo: conTexto('/** x */') });

      await crearClienteGemini({ apiKey: 'k', fetch: fetchFalso }).generar('p');

      expect(fetchFalso.llamadas[0][0]).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
      );
    });

    test('GEMINI_MODELO cambia el modelo usado', async () => {
      process.env.GEMINI_MODELO = 'gemini-prueba';
      const fetchFalso = crearFetchFalso({ cuerpo: conTexto('/** x */') });

      await crearClienteGemini({ apiKey: 'k', fetch: fetchFalso }).generar('p');

      expect(fetchFalso.llamadas[0][0]).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-prueba:generateContent'
      );
    });

    test('sin apiKey en la configuración lee GEMINI_API_KEY y la envía en la cabecera', async () => {
      process.env.GEMINI_API_KEY = 'CLAVE_DEL_ENTORNO';
      const fetchFalso = crearFetchFalso({ cuerpo: conTexto('/** x */') });

      await crearClienteGemini({ fetch: fetchFalso }).generar('p');

      expect(fetchFalso.llamadas[0][1].headers['x-goog-api-key']).toBe('CLAVE_DEL_ENTORNO');
    });

    test('sin apiKey y sin GEMINI_API_KEY lanza el error de clave faltante', () => {
      delete process.env.GEMINI_API_KEY;

      const error = capturarErrorSincrono(() => crearClienteGemini({ fetch: crearFetchFalso() }));

      expect(error.message).toBe(MSG_SIN_CLAVE);
    });
  });
});

describe('crearClienteGemini().generar — la petición que se envía', () => {
  test('usa POST, JSON, la clave solo en la cabecera y el prompt dentro de contents', async () => {
    const fetchFalso = crearFetchFalso({ cuerpo: conTexto('/** x */') });
    const cliente = crearClienteGemini({ apiKey: 'CLAVE_PRUEBA', modelo: 'gemini-x', fetch: fetchFalso });

    await cliente.generar('Hola ñandú ☕');

    expect(fetchFalso.llamadas).toHaveLength(1);
    const [url, opciones] = fetchFalso.llamadas[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent');
    expect(url).not.toContain('CLAVE_PRUEBA');
    expect(opciones.method).toBe('POST');
    expect(opciones.headers).toEqual({ 'Content-Type': 'application/json', 'x-goog-api-key': 'CLAVE_PRUEBA' });
    expect(JSON.parse(opciones.body)).toEqual({ contents: [{ parts: [{ text: 'Hola ñandú ☕' }] }] });
  });
});

describe('crearClienteGemini().generar — Partición: estado HTTP de la respuesta', () => {
  test.each([
    // [descripción, estado]
    ['200 (éxito)', 200, null],
    ['201 (éxito, otro 2xx)', 201, null],
    ['299 (último 2xx)', 299, null],
    ['300 (primer valor fuera de 2xx)', 300, 'Gemini respondió con el estado HTTP 300'],
    ['400 solicitud inválida', 400, 'Gemini respondió con el estado HTTP 400'],
    ['403 clave rechazada', 403, 'Gemini respondió con el estado HTTP 403'],
    ['404 modelo inexistente', 404, 'Gemini respondió con el estado HTTP 404'],
    ['429 demasiadas peticiones', 429, 'Gemini respondió con el estado HTTP 429'],
    ['500 error del servidor', 500, 'Gemini respondió con el estado HTTP 500'],
    ['503 servicio no disponible', 503, 'Gemini respondió con el estado HTTP 503'],
  ])('%s', async (_d, status, mensajeEsperado) => {
    const cliente = crearClienteGemini({
      apiKey: 'CLAVE_PRUEBA',
      modelo: 'm',
      fetch: crearFetchFalso({ status, cuerpo: conTexto('/** ok */') }),
    });

    if (mensajeEsperado === null) {
      await expect(cliente.generar('p')).resolves.toBe('/** ok */');
    } else {
      const error = await capturarError(cliente.generar('p'));
      expect(error.constructor).toBe(Error);
      expect(error.message).toBe(mensajeEsperado);
      expect(error.message).not.toContain('CLAVE_PRUEBA');
    }
  });
});

describe('crearClienteGemini().generar — Partición: forma del cuerpo de la respuesta', () => {
  test.each([
    // [descripción, cuerpo JSON, texto esperado]
    ['una parte con texto', conTexto('/** a */'), '/** a */'],
    ['varias partes: se unen en orden sin separador', conTexto('/** a */', '\n', 'code'), '/** a */\ncode'],
    ['una parte sin texto aporta cadena vacía', { candidates: [{ content: { parts: [{ text: 'a' }, { otra: 1 }, { text: 'b' }] } }] }, 'ab'],
    ['lista de partes vacía (límite inferior): cadena vacía', { candidates: [{ content: { parts: [] } }] }, ''],
    ['solo se usa el primer candidato', { candidates: [{ content: { parts: [{ text: 'uno' }] } }, { content: { parts: [{ text: 'dos' }] } }] }, 'uno'],
    ['texto con tildes, ñ y emojis se conserva', conTexto('Año ñandú café ☕🌱'), 'Año ñandú café ☕🌱'],
  ])('válido: %s', async (_d, cuerpo, esperado) => {
    const cliente = crearClienteGemini({ apiKey: 'k', fetch: crearFetchFalso({ cuerpo }) });

    await expect(cliente.generar('p')).resolves.toBe(esperado);
  });

  test.each([
    // [descripción, cuerpo JSON]
    ['objeto vacío', {}],
    ['null', null],
    ['sin candidatos (lista vacía)', { candidates: [] }],
    ['candidatos no es lista', { candidates: 'x' }],
    ['candidato sin content', { candidates: [{}] }],
    ['content sin parts', { candidates: [{ content: {} }] }],
    ['parts es un texto', { candidates: [{ content: { parts: 'hola' } }] }],
    ['parts es un objeto', { candidates: [{ content: { parts: { text: 'hola' } } }] }],
  ])('inválido: %s → error de formato', async (_d, cuerpo) => {
    const cliente = crearClienteGemini({ apiKey: 'k', fetch: crearFetchFalso({ cuerpo }) });

    const error = await capturarError(cliente.generar('p'));

    expect(error.constructor).toBe(Error);
    expect(error.message).toBe(MSG_FORMATO);
  });
});
