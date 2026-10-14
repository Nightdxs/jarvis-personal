# Solución de problemas

[Volver al inicio](../README.md)

| Síntoma | Acción |
| --- | --- |
| Dictar muestra `network` | En Brave, usa Dictar · Win + H o Dictado Windows y presiona Windows + H. |
| El micrófono no aparece | Revisa el dispositivo de entrada y sus permisos en Windows; consulta [Voz](VOZ.md). |
| No se escucha una respuesta | Marca Leer respuestas, revisa volumen/pestaña silenciada y pulsa Probar voz. |
| No aparece una voz concreta | Solo se enumeran las voces que entrega tu sistema/navegador; no se incluyen voces de Marvel. |
| Codex pendiente | Ejecuta `codex login status`; debe usar ChatGPT. Después verifica en Conexiones. |
| Codex no encontrado | Configura `JARVIS_CODEX_PATH` con el ejecutable nativo, no un archivo `.cmd`. |
| Codex no completó la petición | Comprueba sesión, límites del plan y compatibilidad del CLI. No añadas saldo de API para este modo. |
| Codex tarda demasiado | Reintenta con una tarea más pequeña; el timeout del puente es 180 segundos. |
| Puerto ocupado | Abre la instancia existente o usa otro `PORT`. |
| Origen/Host no autorizado | Usa la URL exacta del servidor y su puerto. Para remoto, configura el origen HTTPS privado. |
| Acción caducada o resuelta | Prepara otra tarjeta; cada acción se usa una vez y dura 30 minutos. |
| Publicación rechazada por secretos | Retira credenciales de los archivos; no publiques notas o configuración privada. |
| GitHub indica nombre existente | La herramienta interna crea repositorios nuevos; solicita otro nombre. |
| Vercel devuelve BUILDING | Consulta el estado hasta READY o ERROR. |
| Dispositivo no autorizado | Comprueba ID exacto y lista de entidades de Home Assistant. |
| El móvil no abre localhost | Localhost es el propio dispositivo; configura acceso privado remoto según Instalación. |

Para reportar un fallo, incluye sistema, versión de Node, versión de Codex, navegador, pasos y texto del error. No incluyas tokens, archivos de autenticación, perfiles personales ni historial completo. Las integraciones externas tienen sus propios estados y límites.
