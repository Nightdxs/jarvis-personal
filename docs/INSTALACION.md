# Instalación y configuración

[Volver al inicio](../README.md)

## 1. Preparar el equipo

Instala Node.js 22+ desde [el proveedor oficial](https://nodejs.org/). La aplicación utiliza únicamente módulos estándar de Node.js. `npm start` inicia el servidor y `npm test` ejecuta las pruebas; no hay paquetes que instalar.

Utiliza una instalación oficial de [Codex CLI](https://learn.chatgpt.com/docs/cli). El puente inicia un ejecutable directamente, con `shell: false`. En Windows busca `codex.exe` en PATH y después en la instalación de escritorio, bajo `%LOCALAPPDATA%\OpenAI\Codex\bin`. Un lanzador `codex.cmd` de npm por sí solo no cumple esa búsqueda: utiliza la ruta de su ejecutable nativo.

Si la detección no encuentra Codex, define la ruta absoluta de tu ejecutable real:

```powershell
$env:JARVIS_CODEX_PATH = 'C:\ruta\real\codex.exe'
& $env:JARVIS_CODEX_PATH login
& $env:JARVIS_CODEX_PATH login status
```

El ejemplo de ruta es un marcador; sustitúyelo por el archivo instalado. El estado debe indicar `Logged in using ChatGPT`. No elijas autenticación por API key. JARVIS necesita un CLI compatible con las opciones documentadas en [Arquitectura](ARQUITECTURA.md).

## 2. Ejecutar

Clona o descarga el repositorio. Ejecuta `Iniciar-JARVIS.cmd` en Windows. Como alternativa:

```powershell
$env:JARVIS_NO_PAID_API = '1'
npm start
```

Abre http://localhost:8787/ y verifica la conexión con ChatGPT. El primer arranque crea las notas iniciales y las carpetas locales. En Windows con el ejecutable de escritorio se comprobó la conversación real. Otras plataformas no han sido verificadas en esta entrega.

No ejecutes una segunda instancia en el mismo puerto. Si necesitas otro puerto:

```powershell
$env:PORT = '8790'
$env:JARVIS_NO_PAID_API = '1'
npm start
```

## Configuración del entorno

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto HTTP; valor inicial 8787. |
| `JARVIS_NO_PAID_API` | Usa `1` para imponer Codex y bloquear API de pago aunque hubiera ajustes anteriores. |
| `JARVIS_CODEX_PATH` | Ruta absoluta del ejecutable oficial de Codex. |
| `JARVIS_PUBLIC_ORIGIN` | Origen HTTPS privado autorizado para un túnel remoto. |
| `JARVIS_ACCESS_CODE` | Código de acceso remoto; mínimo 12 caracteres. |
| `GITHUB_TOKEN` | Token opcional de GitHub, recibido por el servidor. |
| `VERCEL_TOKEN` | Token opcional de Vercel. |
| `HA_TOKEN` / `HA_URL` | Token y URL opcionales de Home Assistant. |

No hay lectura automática de `.env`. También puedes introducir los tokens opcionales en el panel. No los incluyas en scripts, capturas, commits ni conversaciones. Las variables del antiguo modo API permanecen en el código por compatibilidad, pero no son necesarias y no forman parte del arranque recomendado.

## Copias de seguridad

Detén el servidor y guarda una copia privada de `vault/`, `projects/` y `data/`. Son tus notas, proyectos, ajustes e historial; no deben publicarse en GitHub. La autenticación de Codex se mantiene fuera de esas carpetas y se gestiona con Codex.

## Acceso privado desde otro dispositivo

El servidor escucha únicamente en `127.0.0.1`. Para acceder desde fuera del PC, prepara una red privada y un túnel HTTPS, por ejemplo [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve). No se ha instalado ni probado ese túnel en esta entrega.

1. Configura Tailscale y HTTPS según su documentación en los equipos autorizados.
2. Detén JARVIS y ejecuta `Iniciar-remoto.ps1`.
3. Introduce el origen HTTPS privado real y un código de acceso de al menos 12 caracteres.
4. Configura Serve para dirigir el endpoint privado a `http://127.0.0.1:8787`.
5. Abre la URL HTTPS privada con el equipo conectado a tu red e introduce el código.

El PC debe permanecer encendido. No uses una publicación pública del servidor como sustituto de la red privada. Consulta los permisos y condiciones actuales del proveedor antes de activar cualquier servicio opcional.
