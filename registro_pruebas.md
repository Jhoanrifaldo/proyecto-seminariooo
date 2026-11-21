# Registro de pruebas — Semana 7

Proyecto: Sistema Automatizado de Documentación de Código (JSDoc) con IA
Estudiante: Jhoan Rifaldo · Fecha: 2026-11-21
Asistente usado: Claude (Anthropic)

**Adaptación a mi proyecto.** La guía de la tarea habla de `pytest`, pero mi proyecto es Node.js y usa **Jest**. Usé los equivalentes:

| Guía (pytest) | Mi proyecto (Jest) |
|---|---|
| `@pytest.mark.parametrize` | `test.each([...])`, con un comentario por fila |
| `pytest.approx` | `toBeCloseTo` (no hizo falta: mis funciones no devuelven decimales; el único número con unidad es el tiempo en milisegundos, que es entero) |
| `pytest.raises(TipoDeError)` | `error.constructor` comparado con el tipo exacto y `error.message` con el mensaje exacto (ayuda `capturarError`) |
| `pytest -v` | `npx jest --verbose` (o `npm test`) |

**Funciones con reglas que pruebo** (mínimo 3, una con varias condiciones):

1. `documentarCodigo` (`src/documentador.js`) — la regla de HU-01. Es la que combina varias condiciones.
2. `crearClienteGemini(...).generar` (`src/clienteGemini.js`) — validación de configuración y de la respuesta HTTP.
3. `main` de la línea de comandos (`src/cli.js`) — argumentos, archivo y límites.

Ejecutar: `npm ci` y luego `npx jest --verbose`. Estado final: **7 archivos, 170 pruebas, todas pasan** (25 de las semanas 5 y 6 + 145 nuevas) y `npm run lint` sin avisos.

Archivos nuevos: `tests/documentarCodigo.reglas.test.js`, `tests/clienteGemini.reglas.test.js`, `tests/cli.reglas.test.js`, `tests/datosSinteticos.test.js`, `tests/ayudas.js` y `tests/fixtures/datosSinteticos.js`.

---

## 1. Reglas y tablas de casos

> El esperado de cada fila sale de la regla escrita aquí (README, contrato y `@throws` del código), **nunca de ejecutar el código**. Los umbrales (10000, 30000...) están escritos como valores fijos en las pruebas.

### 1.1 `documentarCodigo(codigo, clienteIA, opciones)`

**Regla (HU-01 + contrato del README):**

- R-a. `codigo` debe ser un texto; si no, `TypeError «El código debe ser un texto (string)»`.
- R-b. `codigo` no puede estar vacío ni tener solo espacios; si no, `Error «El código no puede estar vacío»`.
- R-c. `codigo` tiene como máximo 10.000 caracteres (exactamente 10.000 se acepta); si no, `Error «El código supera el máximo de 10000 caracteres»`.
- R-d. `codigo` no puede contener `<<<INICIO_CODIGO>>>` ni `<<<FIN_CODIGO>>>`; si no, `Error «El código no puede contener las marcas internas del prompt»`.
- R-e. En cualquiera de esos rechazos **no se llama a la IA**.
- R-f. `clienteIA` debe tener un método `generar`; si no, `TypeError «El cliente de IA debe tener un método generar(prompt)»`.
- R-g. El prompt lleva primero la orden de usar JSDoc y después el código entre las dos marcas.
- R-h. Si el cliente de IA falla: `Error «No se pudo obtener respuesta de la IA»`, sin detalles internos, con el error original en `error.cause`.
- R-i. Si la IA no responde en `tiempoMaximoMs` (por defecto 30.000 ms): `TiempoAgotadoError «La IA tardó más de N ms en responder»`.
- R-j. Si la respuesta no es texto o está vacía: `Error «La IA devolvió una respuesta vacía o inválida»`.
- R-k. De la respuesta se quitan los espacios de los extremos y las cercas de Markdown (```` ``` ````, ```` ```js ````, ```` ```javascript ````, con `\n` o `\r\n`).
- R-l. Si lo que queda no tiene JSDoc (`/**`): `Error «La IA no devolvió documentación JSDoc»`. Un comentario `/* */` o `//` **no** es JSDoc.
- R-m. Si todo está bien, devuelve el código documentado.

**Partición de equivalencia y valores límite**

| # | Técnica | Entrada / situación | Esperado (fijo) | Regla |
|---|---|---|---|---|
| 1 | Partición inválida | `123`, `null`, `undefined`, arreglo con un texto | `TypeError` + mensaje de R-a; IA sin llamar | R-a, R-e |
| 2 | Partición inválida | `''`, `' '`, `'  \t\r\n  '` | `Error` + «no puede estar vacío»; IA sin llamar | R-b, R-e |
| 3 | Límite inferior | 0 caracteres (último inválido) / `'x'` 1 carácter (primero válido) | rechaza / devuelve documentado | R-b |
| 4 | Límite superior | 10.000 caracteres (último válido) / 10.001 (primero inválido) | acepta, 1 llamada / `Error` «supera el máximo de 10000», 0 llamadas | R-c |
| 5 | Partición inválida | código con `<<<INICIO_CODIGO>>>`; código con `<<<FIN_CODIGO>>>` | `Error` + mensaje de R-d; IA sin llamar | R-d, R-e |
| 6 | Partición válida | README ejemplo 1 (respuesta ya limpia) | misma respuesta | R-m |
| 7 | Partición válida | README ejemplo 2 (cerca ```` ```javascript ````, JSDoc en una línea) | código sin cercas | R-k |
| 8 | Partición válida | cerca sin lenguaje; ```` ```js ````; con espacios tras el lenguaje; con `\r\n`; espacios/saltos antes y después; cerca de apertura sin cierre; comillas invertidas dentro del código | sin cercas, código interno intacto | R-k |
| 9 | Partición inválida (respuesta) | `undefined`, `null`, `42`, objeto, `''`, solo espacios | `Error` «respuesta vacía o inválida» | R-j |
| 10 | Partición inválida (respuesta) | solo charla; código sin comentario; `/* */`; `// `; solo cercas | `Error` «no devolvió documentación JSDoc» | R-l |
| 11 | Partición inválida (cliente) | `undefined`, `null`, texto, `{}`, `{generar: 'x'}` | `TypeError` + mensaje de R-f | R-f |
| 12 | Partición (fallo de la IA) | el cliente lanza `Error`, `TypeError` o un texto | `Error` genérico, sin la clave, `cause` = original | R-h |
| 13 | Límite (tiempo) | por defecto: a 29.999 ms sigue esperando; a 30.000 ms falla | `TiempoAgotadoError` «…30000 ms…» | R-i |
| 14 | Límite (tiempo) | `tiempoMaximoMs=100`: IA que responde a los 99 ms / a los 101 ms | éxito / `TiempoAgotadoError` | R-i |
| 15 | Prompt | cualquier código válido | la orden «JSDoc» va antes de `<<<INICIO_CODIGO>>>`; el código va entre las marcas | R-g |

**Tabla de decisión** (varias condiciones a la vez). C1 código válido · C2 cliente válido · C3 la IA responde sin fallar · C4 la respuesta es texto no vacío · C5 la respuesta trae JSDoc. «–» significa que la condición no importa.

| Regla | C1 | C2 | C3 | C4 | C5 | Resultado esperado | ¿Llama a la IA? |
|---|---|---|---|---|---|---|---|
| D1 | No | – | – | – | – | Error del código (R-a…R-d) | No |
| D2 | Sí | No | – | – | – | `TypeError` del cliente | No |
| D3 | Sí | Sí | No | – | – | «No se pudo obtener respuesta de la IA» | Sí |
| D4 | Sí | Sí | Sí | No | – | «respuesta vacía o inválida» | Sí |
| D5 | Sí | Sí | Sí | Sí | No | «no devolvió documentación JSDoc» | Sí |
| D6 | Sí | Sí | Sí | Sí | Sí | devuelve el código documentado | Sí |

Para D1 la tabla se simplificó (el resto «no importa»), pero probé tres combinaciones: código inválido con cliente válido, con cliente inválido y con IA que falla. D6 la cubre «README ejemplo 1» (misma entrada y mismo esperado).

### 1.2 `crearClienteGemini(config)` y `generar(prompt)`

**Regla (documentación del módulo):**

- G-a. Sin clave de API (cadena vacía, `null`, `undefined`, y sin `GEMINI_API_KEY`) → `Error «Falta la variable de entorno GEMINI_API_KEY (copia .env.example como .env)»`.
- G-b. El modelo solo puede tener letras, números, punto, guion y guion bajo (al menos 1 carácter); si no, `Error «El nombre del modelo de Gemini no es válido»`.
- G-c. Sin modelo se usa `GEMINI_MODELO`, y si tampoco existe, `gemini-2.5-flash`. Sin `apiKey` se lee `GEMINI_API_KEY`.
- G-d. La petición es `POST` a `https://generativelanguage.googleapis.com/v1beta/models/<modelo>:generateContent`, con la clave **solo** en la cabecera `x-goog-api-key`, nunca en la URL, y el prompt en `contents[0].parts[0].text`.
- G-e. Si la respuesta HTTP no es exitosa (fuera de 2xx) → `Error «Gemini respondió con el estado HTTP <código>»`, sin la clave.
- G-f. El texto devuelto es la unión, en orden y sin separador, del `text` de las partes del primer candidato.
- G-g. Si no hay candidatos, contenido o una lista de `parts` → `Error «Respuesta de Gemini con formato inesperado»`.

| # | Técnica | Entrada | Esperado | Regla |
|---|---|---|---|---|
| 1 | Partición inválida | clave `''`, `null`, `undefined` | `Error` + mensaje de clave | G-a |
| 2 | Límite | clave de 1 carácter | crea el cliente | G-a |
| 3 | Límite inferior | modelo `''` (0) / `'a'` (1 carácter) | `Error` modelo / válido | G-b |
| 4 | Partición válida | `gemini-2.5-flash`, `gemini_pro`, `2025` | válido | G-b |
| 5 | Partición inválida | con espacio, `a/b`, `../../otra-ruta`, `gemini?x=1`, `gemini:otraAccion`, salto de línea, `géminis` | `Error` modelo | G-b |
| 6 | Valores por defecto | sin modelo y sin `GEMINI_MODELO`; con `GEMINI_MODELO`; clave tomada de `GEMINI_API_KEY` | URL con `gemini-2.5-flash`; con el modelo de la variable; cabecera con la clave del entorno | G-c |
| 7 | Petición | `generar('Hola ñandú ☕')` | URL exacta, `POST`, cabeceras exactas, cuerpo exacto, clave fuera de la URL | G-d |
| 8 | Partición / límite (HTTP) | 200, 201, 299 (éxito); 300, 400, 403, 404, 429, 500, 503 | texto / `Error` con el estado | G-e |
| 9 | Partición válida (cuerpo) | una parte; varias partes; parte sin `text`; `parts: []` (límite inferior → `''`); dos candidatos; tildes, ñ y emojis | `'/** a */'`; `'/** a */\ncode'`; `'ab'`; `''`; `'uno'`; texto intacto | G-f |
| 10 | Partición inválida (cuerpo) | `{}`, `null`, `candidates: []`, `candidates: 'x'`, sin `content`, sin `parts`, `parts` texto, `parts` objeto | `Error` «formato inesperado» | G-g |

**Tabla de decisión: clave × modelo**

| Regla | Clave presente | Modelo válido | Resultado |
|---|---|---|---|
| G1 | Sí | Sí | crea el cliente |
| G2 | No | Sí | `Error` de clave |
| G3 | Sí | No | `Error` de modelo |
| G4 | No | No | lanza `Error` (no se define cuál va primero; ver ambigüedad A-3) |

### 1.3 `main(argumentos)` de la línea de comandos

**Regla (cabecera de `src/cli.js` y README):**

- C-a. Sin ruta → imprime `Uso: node src/cli.js <archivo.js> [--demo]` en el error estándar y devuelve 1. `--demo` no cuenta como ruta y puede ir antes o después de la ruta.
- C-b. Si la ruta no existe o no es un archivo → `Error: No existe el archivo: <ruta>`, devuelve 1.
- C-c. Si el archivo pesa más de 40.000 bytes (4 bytes × 10.000) → `Error: El archivo supera el máximo de 10000 caracteres`, devuelve 1.
- C-d. Si el contenido no es válido para `documentarCodigo` (vacío, más de 10.000 caracteres) → `Error: <mensaje de la regla R-b/R-c>`, devuelve 1.
- C-e. El límite de la regla es de **caracteres, no de bytes**: un archivo de 10.000 «ñ» (20.000 bytes) es válido.
- C-f. En modo `--demo`, si todo es válido: imprime un bloque JSDoc, el código original sin cambios, un salto de línea final y sin cercas; devuelve 0. Nunca se llama a la API real.

| # | Técnica | Entrada | Esperado | Regla |
|---|---|---|---|---|
| 1 | Partición | `[]`; `['--demo']` | uso + código 1 | C-a |
| 2 | Partición | `[ruta, '--demo']` y `['--demo', ruta]` | igual resultado, código 0 | C-a, C-f |
| 3 | Partición inválida | archivo inexistente; una carpeta | «No existe el archivo» + 1 | C-b |
| 4 | Partición inválida | archivo de 0 bytes; solo espacios | «El código no puede estar vacío» + 1 | C-d |
| 5 | Límite (caracteres) | 1 carácter (válido); 10.000 «x» (válido); 10.001 «x» (inválido) | éxito / éxito / «El código supera el máximo…» | C-d |
| 6 | Límite (bytes) | 40.000 bytes (pasa el filtro de bytes, pero tiene más de 10.000 caracteres); 40.001 bytes (primero rechazado por el filtro) | «El código supera…» / «El archivo supera…» | C-c |
| 7 | Partición válida | 10.000 «ñ» (20.000 bytes) | éxito | C-e |
| 8 | Datos sintéticos | los 10 códigos del fixture (tildes, ñ, emojis, `\r\n`…) | éxito y código idéntico | C-f |

**Tabla de decisión** (C1 hay ruta · C2 existe y es archivo · C3 pesa ≤ 40.000 bytes · C4 contenido válido):

| Regla | C1 | C2 | C3 | C4 | Resultado | Prueba que la cubre (fila de arriba) |
|---|---|---|---|---|---|---|
| M1 | No | – | – | – | uso, código 1 | fila 1 |
| M2 | Sí | No | – | – | «No existe el archivo», 1 | fila 3 |
| M3 | Sí | Sí | No | – | «El archivo supera…», 1 | fila 6 (40.001 bytes) |
| M4 | Sí | Sí | Sí | No | error del documentador, 1 | filas 4, 5 y 6 (40.000 bytes) |
| M5 | Sí | Sí | Sí | Sí | código documentado, 0 | filas 2, 5, 7 y 8 |

### 1.4 Ambigüedades de las reglas

| # | Ambigüedad | Qué decidí | ¿Probada? |
|---|---|---|---|
| A-1 | El README dice que en `codigo` «se ignoran espacios al inicio y al final», pero el límite de 10.000 se mide sobre el texto recibido, con espacios. Un código de 10.000 caracteres más un espacio se rechaza. | Mantengo lo decidido en la semana 6 (hallazgo IA-7 de `revision_seguridad.md`: es coherente con el contrato). **Pendiente de confirmar con el docente.** | No (no quiero fijar con una prueba una regla dudosa) |
| A-2 | «Se ignoran los espacios»: ¿se recortan al enviar a la IA? El código los envía sin recortar. | Pruebo solo lo seguro: el código con espacios alrededor se acepta y la IA lo recibe. | Parcial |
| A-3 | Si fallan varias cosas a la vez (código inválido y cliente inválido), la regla no dice cuál error sale primero. | Sigo el orden de los `@throws` del contrato: primero el código. En el cliente de Gemini (clave y modelo) solo exijo que falle. | Sí (D1 con cliente inválido) |
| A-4 | «10.000 caracteres»: el código cuenta unidades UTF-16, así que un emoji ocupa 2. | Lo dejo como está. | No |
| A-5 | El README exige «un bloque `/** ... */`», pero el código solo revisa que exista `/**`. Una respuesta `/** sin cerrar\nf()` se acepta. | Lo documento como **hallazgo**, sin cambiar el código: cambiarlo altera el contrato entregado en la semana 6. | No |
| A-6 | El criterio de aceptación dice «sin cercas ni texto de charla», pero la tabla de casos solo cubre cercas al inicio y al final. Si la IA responde una frase de charla («¡Claro! Aquí está:»), luego la cerca y el código, el resultado conserva la charla y la cerca de apertura. Lo comprobé a mano. | Lo documento como **hallazgo / mejora futura** y lo consulto con el docente. | No |
| A-7 | Una clave de API de solo espacios se acepta. | Sin decisión; es poco realista. | No |

---

## 2. Revisión de las pruebas generadas por la IA

Apliqué a cada prueba las tres preguntas: 1) ¿el esperado sale de la regla?, 2) ¿fallaría si rompo el código?, 3) ¿cubre algo que otra no cubre?

**Resultado general:** la IA propuso 154 pruebas nuevas en su primera versión. Con el código **sin modificar** pasaron todas desde la primera ejecución, así que no se encontró ningún defecto nuevo y **no se ajustó ningún esperado para que pasara**. La revisión sí cambió la suite:

| # | Prueba | Decisión | Razón (pregunta) | Qué hice en su lugar |
|---|---|---|---|---|
| 1 | CLI: «en modo demo imprime…» comparaba el texto exacto del comentario del modo demo (`(Modo demo) Documentación de ejemplo…`) | **Corregida** | P1: ese esperado salía de leer el código, no de la regla. Si cambia el texto del demo, la prueba fallaría sin haber error. | Nueva ayuda `esperarDocumentado`: comprueba lo que dice la regla (empieza con `/**`, termina con `*/` + el código original + salto de línea, sin cercas). |
| 2 | `documentarCodigo`: filas «objeto» y «booleano» como código no válido | **Descartadas** | P3: misma partición y misma rama que «número», «null» y «undefined» (no es texto). | Quedan número, `null`, `undefined` y el arreglo con un texto (que «parece texto»). |
| 3 | `documentarCodigo`: fila «50.000 caracteres» | **Descartada** | P3: misma partición que 10.001; el borde ya está probado. | Se queda 10.001, el primer valor inválido. |
| 4 | `documentarCodigo`: prueba suelta «R6 todo válido» | **Descartada** | P3: misma entrada y mismo esperado que «README ejemplo 1». | Comentario en el archivo que señala cuál prueba cubre D6. |
| 5 | CLI: bloque «Tabla de decisión» R1–R5 | **Descartado** | P3: cada regla ya la cubría una prueba de particiones (ver tabla de 1.3). | La tabla de decisión queda en este registro con su correspondencia. |
| 6 | Gemini: bloque «Tabla de decisión» R1–R4 | **Reducido a R4** | P3: R1, R2 y R3 ya estaban cubiertas; solo R4 (fallan las dos) era nueva. | Una sola prueba, y como la regla no dice cuál error va primero, solo exige que falle (A-3). |
| 7 | Respuesta con espacios antes de la cerca de apertura (no estaba) | **Agregada** | P2: al romper el código (M08, quitar el `trim` previo) ninguna prueba fallaba. | Fila nueva `'\n  ```js\n…'`. |
| 8 | Temporizador que se cancela al responder a tiempo (no estaba) | **Agregada** | P2: al romper el código (M27) ninguna prueba fallaba. | Prueba con reloj falso: `jest.getTimerCount()` es 0. |
| 9 | Pruebas de la semana 5 y 6 (25) | **Se mantienen** | P3: la nueva suite las repite en parte, pero son parte de entregas anteriores. Las nuevas son más estrictas (tipo y mensaje exactos). | Sin cambios. |

**Esperados que vienen del código y no de la regla (anotados para no engañarme):** los mensajes de error exactos salen de los `@throws` y del README, que son la documentación del código; si algún día cambia un mensaje hay que cambiar la regla y la prueba juntas. La URL de Gemini y el nombre de la cabecera salen de la documentación pública de la API de Google.

**Defectos que descubrieron las pruebas esta semana:** ninguno en el código. Los dos hallazgos de diseño (A-5 y A-6) se explican arriba. El único defecto real que atrapó una prueba en este proyecto sigue siendo el de la semana 5 (`>=` en lugar de `>` en el umbral), y la suite nueva lo vuelve a detectar (M01).

---

## 3. Romper el código a propósito

Cada error se introdujo **uno a la vez** en `src/`, se ejecutaron todas las pruebas y luego se deshizo con `git checkout -- <archivo>` (equivalente a `git restore <archivo>`). Después de cada deshacer, `git status` no mostró cambios en `src/`.

| # | Archivo | Error introducido | Resultado | Pruebas que fallaron (ejemplos) |
|---|---|---|---|---|
| M01 | documentador | `>` → `>=` en el límite (el error real de la semana 5) | Detectado (4) | «límite superior: exactamente 10.000 caracteres», CLI «10.000 caracteres ASCII» |
| M02 | documentador | `trim().length === 0` → `length === 0` | Detectado (4) | «solo un espacio», «solo espacios, tabulación y saltos» |
| M03 | documentador | tiempo por defecto 30000 → 3000 | Detectado (1) | «por defecto espera 30.000 ms» |
| M04 | documentador | JSDoc `/**` relajado a `/*` | Detectado (1) | «comentario de bloque normal /* */» |
| M05 | documentador | la cerca de inicio ya no acepta `\r\n` | Detectado (2) | «cerca con saltos de línea de Windows» |
| M06 | documentador | marcas: `\|\|` → `&&` | Detectado (3) | «contiene la marca de inicio», «…de fin» |
| M07 | documentador | el error del cliente ya no se envuelve | Detectado (5) | «si el cliente lanza un Error…», «R3 todo válido pero la IA falla» |
| M08 | documentador | se quita el `trim` previo a la limpieza | **Sobrevivió** en la 1.ª ejecución → agregué la fila 7 de la sección 2 → ahora **detectado (1)** | «espacios y saltos ANTES de la cerca» |
| M09 | documentador | el prompt recorta el código con `trim()` | **Sobrevive** | Es la ambigüedad A-2; con la regla actual ambas conductas son válidas |
| M10 | documentador | `MAX_CARACTERES` 10000 → 10001 | Detectado (5) | «10.001 caracteres», CLI «10.001 caracteres» |
| M11 | documentador | ya no se valida que `generar` sea función | Detectado (5) | «un texto», «objeto sin generar», «generar no es una función» |
| M12 | documentador | se acepta respuesta de solo espacios | Detectado (3) | «texto vacío», «solo espacios y saltos» |
| M13 | clienteGemini | se ignora el estado HTTP de error | Detectado (8) | «300», «400», «403»… |
| M14 | clienteGemini | la clave pasa a la URL | En la 1.ª ejecución no se aplicó (mi patrón estaba mal escrito); corregido → **detectado (4)** | «envía la clave en la cabecera y no en la URL», «la petición que se envía» |
| M15 | clienteGemini | el modelo vacío pasa a ser válido | Detectado (1) | «modelo inválido: 0 caracteres» |
| M16 | clienteGemini | las partes se unen con `\n` | Detectado (2) | «varias partes: se unen en orden sin…» |
| M17 | clienteGemini | quitar `?? ''` | **Sobrevive: mutante equivalente** | `[undefined].join('')` ya da `''`, así que esa parte del código no cambia ningún resultado; ninguna prueba puede detectarlo |
| M18 | clienteGemini | modelo por defecto 2.5 → 2.0 | Detectado (1) | «sin modelo ni GEMINI_MODELO usa gemini-2.5-flash» |
| M19 | clienteGemini | se usa el segundo candidato | Detectado (15) | «solo se usa el primer candidato» y todas las que leen texto |
| M20 | clienteGemini | la clave vacía ya no se rechaza | Detectado (3) | «sin clave (cadena vacía)», «sin clave (null)» |
| M21 | cli | filtro de bytes `>` → `>=` | Detectado (1) | «40.000 bytes (último tamaño que pasa…)» |
| M22 | cli | ya no se rechaza una carpeta | Detectado (1) | «es una carpeta, no un archivo» |
| M23 | cli | `--demo` solo se reconoce al final | Detectado (1) | «--demo y luego ruta» |
| M24 | cli | se quita el salto de línea final | Detectado (15) | todas las de éxito |
| M25 | cli | sin ruta devuelve 0 | Detectado (2) | «sin argumentos…» |
| M26 | cli | filtro de bytes ×4 → ×2 | Detectado (1) | «40.000 bytes» |
| M27 | documentador | no se cancela el temporizador | **Sobrevivió** en la 1.ª ejecución → agregué la prueba 8 de la sección 2 → ahora **detectado (1)** | «no queda ningún temporizador pendiente» |
| M28 | documentador | se ignora la opción `tiempoMaximoMs` | Detectado (2) | «tiempoMaximoMs=100: …101 ms» |
| M29 | documentador | se deja de validar el JSDoc | Detectado (7) | «solo charla», «código sin ningún comentario»… |
| M30 | clienteGemini | método `POST` → `GET` | Detectado (1) | «la petición que se envía» |
| M31 | clienteGemini | cabecera `x-goog-api-key` → `x-api-key` | Detectado (3) | «la petición que se envía» |
| M32 | cli | ante un error devuelve 0 | Detectado (9) | «no existe», «es una carpeta»… |
| M33 | cli | `--demo` ya no se descarta de la lista de rutas | Detectado (2) | «solo --demo (sin ruta)» |

**Balance:** 33 errores introducidos. En la primera ejecución sobrevivieron 4 (M08, M09, M17, M27) y uno no se aplicó (M14). Los casos que faltaban para M08 y M27 se agregaron; M09 es una ambigüedad (A-2); M17 es equivalente. Al final, **31 de 33 quedan detectados**, y los 2 restantes están explicados.

---

## 4. Datos de prueba sintéticos

- **Origen:** los generó la IA (Claude) con este contexto: «fragmentos de código JavaScript de una tienda de café del Huila, con nombres en español y casos difíciles». Están en `tests/fixtures/datosSinteticos.js` y los usan `tests/datosSinteticos.test.js` y `tests/cli.reglas.test.js`.
- **Sin personas reales:** los nombres («Ana Ejemplo Peña», «Productor…», «Finca Ficticia El Ejemplo») son inventados. Los teléfonos usan el patrón ficticio `300 000 0000`. Las referencias locales (Neiva, Garzón, Pitalito, La Plata, Timaná, café) son municipios y productos del Huila, no datos de personas. No usé datos míos ni de mi familia.
- **Casos difíciles incluidos (10):**

| # | Caso difícil |
|---|---|
| 1 | Tilde en el nombre de la función (`calcularPrecioCafé`) |
| 2 | Letra ñ en identificadores y textos (`añoCosecha`, `nombreNiño`) |
| 3 | Apóstrofo escapado dentro de un texto |
| 4 | Texto vacío como valor (`''`) y función sin cuerpo |
| 5 | Valores en cero |
| 6 | Teléfono ficticio y nombre inventado |
| 7 | Plantilla con comillas invertidas (`` `Hola ${nombre}` ``) |
| 8 | Saltos de línea de Windows (`\r\n`) dentro del código |
| 9 | Emojis, uno de ellos de 2 unidades UTF-16 (☕ 🌱) |
| 10 | Comillas dobles y tabulaciones |

- **Uso:** en `datosSinteticos.test.js` cada caso se prueba dos veces (respuesta limpia y respuesta con cerca) y se comprueba que el código llega intacto dentro de las marcas del prompt. En `cli.reglas.test.js` cada caso se escribe a un archivo temporal y se ejecuta la CLI en modo demo, para comprobar también la lectura en UTF-8. Los archivos temporales se borran al terminar.
