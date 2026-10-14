# Seguridad y privacidad

JARVIS está pensado para un usuario en su PC y, opcionalmente, acceso mediante una red privada. No es un servicio público multiusuario ni ha recibido una auditoría independiente de seguridad.

## Controles implementados

- HTTP limitado a `127.0.0.1`, validación de Host y origen de las escrituras.
- Sesión aleatoria en cookie HttpOnly/SameSite Strict; Secure en modo remoto HTTPS.
- Cabecera `X-Jarvis`, JSON obligatorio y límite del cuerpo de las peticiones.
- Origen HTTPS explícito y código de al menos 12 caracteres para acceso remoto.
- Rutas/extensiones limitadas, rechazo de symlinks y nombres reservados.
- Vistas previas con sandbox y restricciones de conexión.
- Credenciales opcionales en memoria del servidor y redacción de secretos conocidos.
- Revisión previa, copia de publicación y consumo único de aprobaciones.
- Puente de Codex sin shell ni herramientas nativas de ejecución, con autenticación ChatGPT forzada.
- API de pago bloqueada en los lanzadores recomendados.

La redacción de secretos conocidos no detecta cualquier dato sensible. Una nota puede contener información privada que el modelo reciba como contexto. No guardes contraseñas, tokens ni datos innecesarios en memoria.

## Datos y destinos

| Datos | Destino |
| --- | --- |
| Notas, ajustes sin tokens, historial y proyectos | `vault/`, `data/` y `projects/` en el PC, sin cifrado añadido por JARVIS. |
| Petición, historial acotado y fragmentos de memoria | Codex/OpenAI para producir una respuesta. |
| Audio de dictado | Proveedor de reconocimiento del navegador, o Microsoft con Windows + H. |
| Ciudad y coordenadas de consulta | Open-Meteo. |
| Archivos estáticos aprobados | GitHub o Vercel según la acción solicitada. |
| Entidad/acción aprobada | La instancia configurada de Home Assistant. |
| Autenticación de Codex | Almacén gestionado por Codex; JARVIS no lo copia al proyecto. |

Las voces de lectura dependen del sistema/navegador; no se garantiza que todos sus motores trabajen offline. El modo local sin código de acceso permite que procesos del mismo equipo abran el panel, por lo que el sistema operativo también forma parte de la confianza.

## Publicar y respaldar

No añadas `data/`, `vault/`, `projects/`, `.env`, logs, archivos de autenticación de Codex ni capturas personales a Git. `.gitignore` reduce errores habituales, pero revisa siempre `git diff --cached` antes de subir cambios. Los backups de datos del usuario deben mantenerse privados.

No expongas el servidor directamente a Internet. El acceso remoto documentado necesita HTTPS y una red privada configurada por el propietario.

## Reportar un problema

Para errores funcionales, abre un issue con una reproducción que no incluya información privada. Para una vulnerabilidad explotable, evita publicar credenciales o instrucciones contra una instalación real; usa un canal privado acordado con el propietario. Este repositorio no ofrece un programa formal de recompensas ni un plazo de respuesta garantizado.
