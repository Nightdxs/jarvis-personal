# Validación y límites de la entrega

[Volver al inicio](../README.md)

Fecha de la entrega: **13 de octubre de 2026**, zona America/Lima. Entorno: Windows, Node.js 24.19.0, ejecutable oficial de Codex disponible en la aplicación de escritorio y sesión de ChatGPT. Esta es evidencia de esa instalación, no una certificación para todas las versiones y equipos.

## Pruebas automatizadas

`npm test` ejecuta 19 pruebas con `node:test`, sin dependencias. La última ejecución pasó las 19. Las respuestas de servicios externos y el proceso de Codex se simulan en la suite para evitar consumo del plan y efectos externos.

| Área | Cobertura |
| --- | --- |
| Memoria | Relevancia, exclusión de notas no relacionadas, fragmentos e historial acotado. |
| Archivos | Traversal, rutas ocultas, nombres reservados de Windows, symlinks y persistencia. |
| Secretos | Rechazo de credenciales conocidas en notas, proyectos y conversación. |
| Herramientas | Resultados reales del mock en el siguiente turno, razonamiento y errores. |
| Aprobaciones | Copia revisada, caducidad/resolución y ejecución única. |
| Servidor | Sesión, escrituras entre orígenes, host y requisitos de remoto HTTPS. |
| Servicios | Open-Meteo sin claves OpenAI y entidades autorizadas de Home Assistant. |
| Compatibilidad anterior | Negociación Realtime, duplicados, fallo de autenticación y limpieza de audio. |
| Modo ChatGPT | Herramientas mediante Codex sin API key, bloqueo de API y aislamiento del proceso. |

## Comprobaciones reales

- Codex indicó inicio de sesión mediante ChatGPT.
- El servidor respondió a una petición de texto usando ese plan.
- `list_notes` devolvió los cuatro archivos de memoria iniciales.
- El estado mostró proveedor Codex, API de pago bloqueada y ninguna API key cargada.
- Se consultó el servicio real de clima durante el desarrollo.
- El panel mostró selector de voces, tono, velocidad y la alternativa Windows + H.
- Se verificó que, en Brave, el botón de dictado enfoca el mensaje y no inicia el reconocimiento web que fallaba con `network`.

## Pendiente de comprobar en cada instalación

- Reconocimiento real del micrófono con Windows + H y calidad de reproducción audible.
- Publicación mediante los tokens opcionales de la app en GitHub y Vercel.
- Home Assistant con entidades reales y reacción física de los dispositivos.
- Túnel privado remoto y navegación móvil.
- Otros sistemas operativos y versiones de CLI.

Las capturas de la documentación usan una instancia limpia: no incluyen conversaciones, notas personales ni claves. La apariencia de una conexión no reemplaza una prueba de extremo a extremo de cada integración. El código Realtime se conserva para compatibilidad, pero la versión distribuida no lo habilita ni promete voz continua.
