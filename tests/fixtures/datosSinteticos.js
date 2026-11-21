/**
 * Datos de prueba SINTÉTICOS (semana 7). Ninguno pertenece a una persona real.
 *
 * Origen: los generó la IA (Claude) con este contexto: «fragmentos de código
 * JavaScript de una tienda de café del Huila, con nombres en español y casos
 * difíciles: tildes, ñ, apóstrofo, texto vacío, valores en cero, comillas,
 * plantillas con comillas invertidas, saltos de línea de Windows y emojis».
 * Los nombres de personas, fincas y teléfonos son inventados (los teléfonos
 * usan el patrón 300 000 0000, que no corresponde a ninguna línea real).
 *
 * Cada caso tiene:
 *  - nombre: qué caso difícil representa.
 *  - codigo: el código que el usuario pediría documentar.
 *  - jsdoc: el bloque JSDoc que respondería la IA (también inventado).
 */

const CASOS_SINTETICOS = [
  {
    nombre: 'tilde en el nombre de la función (café)',
    codigo: 'function calcularPrecioCafé(kilos, precioPorKilo) {\n  return kilos * precioPorKilo;\n}',
    jsdoc:
      '/**\n * Calcula el precio de un pedido de café.\n * @param {number} kilos Kilos pedidos.\n * @param {number} precioPorKilo Precio de cada kilo.\n * @returns {number} Valor total.\n */',
  },
  {
    nombre: 'letra ñ en identificadores y textos',
    codigo: "const añoCosecha = 2026;\nfunction nombreNiño() {\n  return 'Niño Ñandú Ejemplo';\n}",
    jsdoc: '/**\n * Devuelve un nombre inventado.\n * @returns {string} Nombre de ejemplo.\n */',
  },
  {
    nombre: 'apóstrofo escapado dentro de un texto',
    codigo: "const saludo = 'Bienvenido a la finca \\'Ficticia El Ejemplo\\' (Pitalito)';",
    jsdoc: '/**\n * Saludo de bienvenida de una finca inventada.\n * @type {string}\n */',
  },
  {
    nombre: 'texto vacío como valor',
    codigo: "const nombreProductor = '';\nfunction vacia() {}",
    jsdoc: '/**\n * Función sin cuerpo.\n * @returns {void}\n */',
  },
  {
    nombre: 'valores en cero',
    codigo: 'const inventario = { cafe: 0, panela: 0, total: 0 };\nfunction descuento() {\n  return 0;\n}',
    jsdoc: '/**\n * Descuento fijo en cero.\n * @returns {number} Siempre 0.\n */',
  },
  {
    nombre: 'teléfono ficticio y nombre inventado',
    codigo:
      "const productor = { nombre: 'Ana Ejemplo Peña', telefono: '300 000 0000', municipio: 'Garzón' };",
    jsdoc: '/**\n * Ficha de un productor inventado.\n * @type {{nombre: string, telefono: string, municipio: string}}\n */',
  },
  {
    nombre: 'plantilla con comillas invertidas',
    codigo: 'const mensaje = (nombre) => `Hola ${nombre}, bienvenido a Neiva`;',
    jsdoc: '/**\n * Arma un saludo.\n * @param {string} nombre Nombre de quien recibe el saludo.\n * @returns {string} Saludo completo.\n */',
  },
  {
    nombre: 'saltos de línea de Windows (\\r\\n) dentro del código',
    codigo: 'function sumar(a, b) {\r\n  return a + b;\r\n}',
    jsdoc: '/**\n * Suma dos números.\n * @param {number} a Primer sumando.\n * @param {number} b Segundo sumando.\n * @returns {number} La suma.\n */',
  },
  {
    nombre: 'emojis (uno de ellos ocupa dos unidades UTF-16)',
    codigo: "const etiqueta = '☕ Café de La Plata 🌱';",
    jsdoc: '/**\n * Etiqueta decorativa.\n * @type {string}\n */',
  },
  {
    nombre: 'comillas dobles y tabulaciones',
    codigo: 'function municipio() {\n\treturn "Timaná";\n}',
    jsdoc: '/**\n * Devuelve un municipio del Huila.\n * @returns {string} Nombre del municipio.\n */',
  },
];

module.exports = { CASOS_SINTETICOS };
