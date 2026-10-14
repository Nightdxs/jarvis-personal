# JARVIS Personal: mapa del proyecto

Lee este archivo primero. Consulta únicamente los módulos relevantes para la tarea; no cargues todo el vault o el historial por defecto.

## Módulos

- `core.mjs`: motor, claves en memoria, herramientas, aprobaciones, memoria y sesiones Realtime.
- `memory.mjs`: búsqueda por palabras, selección de fragmentos y límites de historial.
- `files.mjs`: acceso a archivos limitado a las carpetas autorizadas.
- `codex-bridge.mjs`: motor mediante Codex CLI con sesión ChatGPT, sin claves de API y sin herramientas nativas de ejecución.
- `server.mjs`: HTTP local, sesión del panel, protección de origen y rutas de API.
- `public/app.js`: interfaz, memoria, proyectos y conexiones.
- `public/realtime.js`: WebRTC, audio, transcripciones, interrupciones y cierre.
- `tests/core.test.mjs`: pruebas del motor y servidor. Las pruebas adicionales cubren Realtime y contexto.
- `vault/`: identidad, perfil, estilo y notas del usuario en Markdown.
- `projects/`: webs estáticas que crea el asistente.
- `data/`: estado local sin claves.

## Criterios de mantenimiento

El modo normal utiliza Codex con ChatGPT. El usuario no autoriza costes adicionales: conserva el bloqueo de API de pago y no habilites Realtime ni autenticación por API key. Solo el propietario puede cambiar ese requisito mediante una instrucción explícita. Las pruebas de compatibilidad con el antiguo modo API usan respuestas simuladas y autorización de API únicamente en sus fixtures.

Conserva el español y los archivos del usuario. Usa Node.js 22+ sin dependencias para esta aplicación. Las claves permanecen en memoria o variables de entorno; nunca se escriben en el código, el vault, los logs ni los proyectos. Las acciones externas necesitan una tarjeta de revisión y aprobación. No ejecutes código o comandos generados por el modelo. Mantén el aislamiento de vistas previas y los controles de autenticación. Para voz, libera micrófono y conexión y solicita cierre remoto. No declares una integración verificada sin pruebas reales con sus credenciales.

Comprueba los módulos modificados y ejecuta `npm test` para cambios en herramientas, acceso, memoria o voz. Las pruebas con respuestas simuladas deben identificarse como tales; no uses credenciales reales para pruebas que crean efectos externos.
