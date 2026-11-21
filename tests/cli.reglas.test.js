/**
 * Semana 7 — Pruebas de reglas de la función `main` de la línea de comandos.
 * Se llama a `main` directamente (sin abrir otro proceso) y se vigila lo que
 * escribe en pantalla. Todos los archivos usados son temporales y sintéticos.
 * Solo se usa el modo --demo: así NUNCA se llama a la API real de Gemini.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { main } = require('../src/cli');
const { CASOS_SINTETICOS } = require('./fixtures/datosSinteticos');

const USO = 'Uso: node src/cli.js <archivo.js> [--demo]';

let carpeta;
let salida;
let errores;

beforeEach(() => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'jsdoc-ia-'));
  salida = [];
  errores = [];
  jest.spyOn(process.stdout, 'write').mockImplementation((texto) => {
    salida.push(String(texto));
    return true;
  });
  jest.spyOn(console, 'error').mockImplementation((...partes) => {
    errores.push(partes.join(' '));
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

/**
 * Crea un archivo temporal con el contenido indicado.
 * @param {string} nombre Nombre del archivo.
 * @param {string|Buffer} contenido Contenido a escribir.
 * @returns {string} Ruta absoluta del archivo.
 */
function crearArchivo(nombre, contenido) {
  const ruta = path.join(carpeta, nombre);
  // Ruta armada por la propia prueba dentro de una carpeta temporal (no viene de la red).
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.writeFileSync(ruta, contenido);
  return ruta;
}

/**
 * Comprueba lo que la CLI imprimió, según la regla de la HU-01: un bloque JSDoc,
 * luego el código original SIN cambios, un salto de línea final y ninguna cerca de Markdown.
 * (No se compara el texto exacto del comentario del modo demo: eso lo decide el código, no la regla.)
 * @param {string} textoImpreso Todo lo escrito en la salida estándar.
 * @param {string} contenido Contenido original del archivo.
 */
function esperarDocumentado(textoImpreso, contenido) {
  expect(textoImpreso.startsWith('/**')).toBe(true);
  expect(textoImpreso.endsWith('*/\n' + contenido + '\n')).toBe(true);
  expect(textoImpreso).not.toContain('```');
}

describe('cli main — Partición: argumentos', () => {
  test('sin argumentos: muestra cómo se usa y devuelve 1', async () => {
    const codigo = await main([]);

    expect(codigo).toBe(1);
    expect(errores).toEqual([USO]);
    expect(salida).toEqual([]);
  });

  test('solo --demo (sin ruta): muestra cómo se usa y devuelve 1', async () => {
    const codigo = await main(['--demo']);

    expect(codigo).toBe(1);
    expect(errores).toEqual([USO]);
  });

  test.each([
    // [descripción, función que arma los argumentos a partir de la ruta]
    ['ruta y luego --demo', (ruta) => [ruta, '--demo']],
    ['--demo y luego ruta', (ruta) => ['--demo', ruta]],
  ])('el orden no importa: %s', async (_d, armar) => {
    const ruta = crearArchivo('sumar.js', 'function sumar(a, b) { return a + b; }');

    const codigo = await main(armar(ruta));

    expect(codigo).toBe(0);
    esperarDocumentado(salida.join(''), 'function sumar(a, b) { return a + b; }');
  });
});

describe('cli main — Partición: el archivo', () => {
  test('no existe: error «No existe el archivo» y devuelve 1', async () => {
    const ruta = path.join(carpeta, 'no-existe.js');

    const codigo = await main([ruta, '--demo']);

    expect(codigo).toBe(1);
    expect(errores).toEqual([`Error: No existe el archivo: ${ruta}`]);
    expect(salida).toEqual([]);
  });

  test('es una carpeta, no un archivo: mismo error', async () => {
    const codigo = await main([carpeta, '--demo']);

    expect(codigo).toBe(1);
    expect(errores).toEqual([`Error: No existe el archivo: ${carpeta}`]);
  });

  test.each([
    // [descripción, contenido, mensaje exacto]
    ['archivo vacío (0 bytes)', '', 'Error: El código no puede estar vacío'],
    ['archivo solo con espacios y saltos', '  \n\t\n ', 'Error: El código no puede estar vacío'],
    ['10.001 caracteres (primer valor sobre el límite)', 'x'.repeat(10001), 'Error: El código supera el máximo de 10000 caracteres'],
    ['40.000 bytes (último tamaño que pasa el filtro de bytes)', 'x'.repeat(40000), 'Error: El código supera el máximo de 10000 caracteres'],
    ['40.001 bytes (primer tamaño que el filtro de bytes rechaza)', 'x'.repeat(40001), 'Error: El archivo supera el máximo de 10000 caracteres'],
  ])('contenido inválido: %s', async (_d, contenido, mensaje) => {
    const ruta = crearArchivo('entrada.js', contenido);

    const codigo = await main([ruta, '--demo']);

    expect(codigo).toBe(1);
    expect(errores).toEqual([mensaje]);
    expect(salida).toEqual([]);
  });

  test.each([
    // [descripción, contenido]
    ['1 carácter (primer valor aceptado)', 'x'],
    ['10.000 caracteres ASCII (límite exacto)', 'x'.repeat(10000)],
    ['10.000 caracteres «ñ» (20.000 bytes: el límite es en caracteres, no en bytes)', 'ñ'.repeat(10000)],
  ])('contenido válido: %s', async (_d, contenido) => {
    const ruta = crearArchivo('entrada.js', contenido);

    const codigo = await main([ruta, '--demo']);

    expect(codigo).toBe(0);
    expect(errores).toEqual([]);
    esperarDocumentado(salida.join(''), contenido);
  });
});

// La tabla de decisión de `main` (registro_pruebas.md, sección 1) no tiene bloque propio: cada una de
// sus reglas ya la cubre una prueba de las particiones de arriba (ver sección 2 del registro).

describe('cli main — datos sintéticos con casos difíciles (tildes, ñ, emojis, \\r\\n)', () => {
  test.each(CASOS_SINTETICOS.map((caso) => [caso.nombre, caso.codigo]))('%s', async (_nombre, codigoSintetico) => {
    const ruta = crearArchivo('sintetico.js', codigoSintetico);

    const codigo = await main([ruta, '--demo']);

    expect(codigo).toBe(0);
    esperarDocumentado(salida.join(''), codigoSintetico);
  });
});
