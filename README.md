# Sistema Automatizado de Documentación de Código (JSDoc) con IA

## 1. Qué es

Proyecto final del Seminario de IA Aplicada al Ciclo de Vida del Software (FET).

El sistema recibe un bloque de código JavaScript sin comentarios, lo envía a un modelo de IA (Gemini) con un prompt estricto y devuelve el **mismo código** con comentarios JSDoc encima (`@param`, `@returns`), sin texto extra. La idea es que VS Code muestre la documentación al pasar el ratón sobre la función sin tener que corregir nada.

Hoy se usa como **módulo de Node.js** (`documentarCodigo`) y como **línea de comandos** (`src/cli.js`). La API HTTP centralizada es un pendiente del proyecto (ver `revision_seguridad.md`).

### Historia de usuario implementada

**HU-01 — Documentar un bloque de código con JSDoc** (prioridad Must)

> Como desarrollador, quiero enviar un bloque de código sin comentarios y recibirlo de vuelta documentado con JSDoc, sin texto adicional, para poder pegarlo directamente en mi editor.

**Criterio de aceptación**

- **Dado** un bloque de código JavaScript válido (no vacío y de máximo 10.000 caracteres),
  **cuando** lo envío al documentador,
  **entonces** recibo el código con al menos un bloque `/** ... */` y sin cercas de Markdown (```` ``` ````) ni texto de charla.
- **Escenario de error:** si el código está vacío, no es texto o supera los 10.000 caracteres, el sistema lo rechaza con un error claro **sin llamar a la IA**. Si la IA responde sin ningún bloque JSDoc, el sistema lanza un error en lugar de devolver una respuesta inválida.

### Contrato de `documentarCodigo`

```js
/**
 * @param {string} codigo       Bloque de código JavaScript a documentar.
 * @param {{ generar: (prompt: string) => Promise<string> }} clienteIA
 *        Cliente de IA. Recibe el prompt y devuelve el texto de la IA.
 * @param {{ tiempoMaximoMs?: number }} [opciones]
 *        Tiempo máximo de espera de la IA (por defecto 30.000 ms).
 * @returns {Promise<string>}   El código documentado con JSDoc, limpio.
 * @throws {TypeError}          Si `codigo` no es string o `clienteIA` no tiene `generar`.
 * @throws {Error}              Si `codigo` está vacío, supera 10.000 caracteres o
 *                              contiene las marcas internas del prompt; si la IA falla,
 *                              responde vacío o sin un bloque JSDoc.
 * @throws {TiempoAgotadoError} Si la IA no responde a tiempo.
 */
async function documentarCodigo(codigo, clienteIA, opciones = {})
```

#### Qué recibe

- `codigo`: texto con el código a documentar. Se ignoran espacios al inicio y al final.
- `clienteIA`: objeto con un método `generar(prompt)`. En producción envuelve la API de Gemini; en las pruebas es un cliente falso, así las pruebas no gastan cuota ni necesitan clave.

#### Qué devuelve

- Una promesa con el código documentado: sin cercas ```` ```js ```` / ```` ``` ````, sin espacios sobrantes al inicio o al final, y que contiene al menos un bloque `/** ... */`.

#### Supuestos

- El código de entrada es JavaScript (o TypeScript sencillo).
- El prompt que se envía a la IA siempre incluye el código y la instrucción de usar JSDoc y no agregar texto extra.
- La clave de la API vive en una variable de entorno (`GEMINI_API_KEY`), nunca en el código.

#### Casos límite

| Caso | Resultado |
|---|---|
| Código con exactamente 10.000 caracteres | Se acepta |
| Código con 10.001 caracteres | Error, no se llama a la IA |
| Código vacío o solo espacios | Error, no se llama a la IA |
| La IA envuelve la respuesta en ```` ```javascript ```` | Se quitan las cercas |
| La IA responde sin `/**` | Error «La IA no devolvió documentación JSDoc» |
| La IA usa saltos de línea de Windows (`\r\n`) | Se quitan igual las cercas |
| El código contiene `<<<FIN_CODIGO>>>` | Error, no se llama a la IA (evita inyección de prompt) |
| La IA no responde en 30 s | `TiempoAgotadoError` |
| El cliente de IA falla (red, HTTP 403…) | Error «No se pudo obtener respuesta de la IA» (sin detalles internos; el original en `error.cause`) |

#### Ejemplos de entrada y salida

| # | Entrada `codigo` | Respuesta de la IA | Salida |
|---|---|---|---|
| 1 | `function sumar(a, b) { return a + b; }` | `/**\n * Suma dos números.\n * @param {number} a\n * @param {number} b\n * @returns {number}\n */\nfunction sumar(a, b) { return a + b; }` | La misma respuesta (ya está limpia) |
| 2 | `const doble = n => n * 2;` | ```` ```javascript\n/** Duplica n. @param {number} n @returns {number} */\nconst doble = n => n * 2;\n``` ```` | `/** Duplica n. @param {number} n @returns {number} */\nconst doble = n => n * 2;` |
| 3 | `"   "` | (no se llama) | Error: «El código no puede estar vacío» |
| 4 | `123` | (no se llama) | `TypeError`: «El código debe ser un texto (string)» |

## 2. Requisitos

- **Node.js 18 o superior** (con npm). Para que `.env` se cargue solo, Node 20.12 o superior; con Node 18 exporta la variable a mano (ver Ejecución).
- **Git**, para clonar el repositorio.
- Solo para usar la IA real: una **clave de API de Gemini** (Google AI Studio). Las pruebas y el modo demo **no** la necesitan.

## 3. Instalación

```bash
git clone https://github.com/Jhoanrifaldo/proyecto-semi.git
cd proyecto-semi
npm ci
```

`npm ci` instala exactamente las versiones de `package-lock.json`. Para usar Gemini, crea tu archivo de entorno a partir de la plantilla y pon tu clave (el archivo `.env` está en `.gitignore` y nunca se sube):

```bash
cp .env.example .env      # en Windows (PowerShell): Copy-Item .env.example .env
```

## 4. Ejecución

**Modo demo** (sin clave ni internet; usa un cliente de IA simulado):

```bash
npm run demo
# equivale a: node src/cli.js ejemplos/sumar.js --demo
```

**Con Gemini** (necesita `GEMINI_API_KEY` en `.env` o en el entorno):

```bash
node src/cli.js ejemplos/sumar.js
node src/cli.js ruta/a/tu-archivo.js > tu-archivo.documentado.js
```

Si tu Node es anterior a 20.12, define la clave en la terminal antes de ejecutar:
`export GEMINI_API_KEY=tu_clave` (Linux/macOS) o `$env:GEMINI_API_KEY="tu_clave"` (PowerShell).

El resultado se imprime en la salida estándar. Si algo falla (archivo inexistente, sin clave, la IA no responde), se muestra `Error: …` y el programa termina con código 1.

**Como módulo**, inyectando el cliente de IA:

```js
const { documentarCodigo } = require('./src/documentador');
const { crearClienteGemini } = require('./src/clienteGemini');

const documentado = await documentarCodigo('function sumar(a, b) { return a + b; }', crearClienteGemini());
```

## 5. Pruebas

```bash
npm test        # 170 pruebas con Jest: no necesitan clave de API ni internet
npm run lint    # ESLint con reglas recomendadas y de seguridad (eslint-plugin-security)
```

Las pruebas usan clientes de IA y `fetch` falsos, así no gastan cuota. Desde la semana 7 hay además pruebas de reglas (ver [`registro_pruebas.md`](registro_pruebas.md)). Incluyen pruebas de abuso (inyección de prompt, nombre de modelo que intenta cambiar la URL, errores que podrían filtrar la clave).

## 6. Estructura

```
proyecto-semi/
├── src/
│   ├── documentador.js        # Lógica de HU-01: validar, armar prompt, llamar a la IA, limpiar y comprobar JSDoc
│   ├── clienteGemini.js       # Cliente de IA real (API REST de Gemini), cumple generar(prompt)
│   └── cli.js                 # Línea de comandos (modo Gemini y modo --demo)
├── tests/
│   ├── documentador.test.js          # semana 5-6
│   ├── clienteGemini.test.js         # semana 5-6
│   ├── cli.test.js                   # semana 5-6
│   ├── documentarCodigo.reglas.test.js   # semana 7: particiones, límites y tabla de decisión
│   ├── clienteGemini.reglas.test.js      # semana 7
│   ├── cli.reglas.test.js                # semana 7
│   ├── datosSinteticos.test.js           # semana 7
│   ├── ayudas.js                         # ayudas compartidas (no son pruebas)
│   └── fixtures/datosSinteticos.js       # datos de prueba sintéticos
├── ejemplos/sumar.js          # Archivo de entrada para probar la CLI
├── revision_seguridad.md      # Informe de revisión de código y seguridad (semana 6)
├── registro_pruebas.md        # Reglas, tablas de casos, revisión, errores provocados y datos (semana 7)
├── bitacora_ia.md             # Bitácora de uso de IA
├── eslint.config.js           # Configuración del linter
├── .env.example               # Plantilla de variables de entorno (sin claves)
└── package.json
```

## 7. Uso de IA

- Durante el desarrollo usé un asistente de IA (Claude, de Anthropic) para proponer el diseño, generar borradores de código, pruebas y documentación, y hacer una segunda revisión de seguridad. Cada sugerencia se verificó con pruebas y lectura del código; las decisiones (aceptadas, modificadas y rechazadas) están en [`bitacora_ia.md`](bitacora_ia.md), y la revisión de seguridad con sus falsos positivos en [`revision_seguridad.md`](revision_seguridad.md).
- En tiempo de ejecución, el sistema usa **Gemini** para generar el JSDoc. El código que documentes se envía a Google, así que no lo uses con código confidencial si tu organización no lo permite. Revisa siempre el resultado antes de guardarlo: la IA puede equivocarse en los tipos o, en casos raros, cambiar el código.

## 8. Autor y licencia

- **Autor:** Jhoan Rifaldo — FET, Seminario de IA Aplicada al Ciclo de Vida del Software, 2026.
- **Licencia:** MIT (ver [`LICENSE`](LICENSE)).
