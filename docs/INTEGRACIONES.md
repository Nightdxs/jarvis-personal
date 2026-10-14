# Integraciones opcionales

[Volver al inicio](../README.md)

No necesitas estas conexiones para conversar ni editar tu memoria. Cada proveedor tiene sus condiciones y límites; JARVIS no incluye una cuenta ni garantiza que los servicios opcionales sean gratuitos. Los tokens se introducen en Conexiones o mediante variables del entorno del servidor y no se persisten en sus archivos de ajustes.

## GitHub

La herramienta interna crea un **repositorio privado nuevo** en la cuenta personal y sube la copia revisada de un proyecto estático. No actualiza repositorios existentes ni publica la instalación completa de JARVIS.

Necesita un token que pueda crear ese repositorio y escribir sus archivos. Consulta la documentación oficial de [crear repositorios](https://docs.github.com/en/rest/repos/repos#create-a-repository-for-the-authenticated-user) y [crear contenido](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents). Si el nombre existe, elige otro. Si falla una subida parcial, revisa el repositorio creado antes de reintentar.

Ejemplo: «Prepara subir mi-web a un repositorio nuevo llamado mi-web». Revisa y aprueba la tarjeta. No pegues el token en el mensaje.

## Vercel

Introduce tu token y, si corresponde, el Team ID. La aplicación envía archivos estáticos; no compila frameworks. Revisa y aprueba la tarjeta de despliegue. Guarda el ID y consulta el estado hasta READY; QUEUED o BUILDING no significan que la web ya esté lista.

La URL puede tener protección de acceso según la cuenta. Un despliegue de un proyecto no sube el servidor de JARVIS ni sus notas. Referencia: [API de despliegues de Vercel](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment).

## Home Assistant

Configura URL base, un Long-Lived Access Token y una lista explícita de entidades, por ejemplo `light.salon, switch.tele, scene.cine`. Usa HTTPS cuando el servicio esté fuera de tu red local.

Se permite encender/apagar `light` y `switch`, y activar `scene`. Las acciones se preparan para revisión y necesitan aprobación. Después de la solicitud se consulta el estado reportado por Home Assistant; esto no prueba por sí solo que el dispositivo físico reaccionara.

No existe acceso directo a Alexa ni se requiere una contraseña de Amazon. Para usar los mismos dispositivos de Alexa deben estar integrados también en Home Assistant. Referencia: [REST API de Home Assistant](https://developers.home-assistant.io/docs/api/rest/).

## Open-Meteo

La consulta meteorológica no necesita un token de OpenAI para acceder al proveedor. La herramienta envía el nombre de la ciudad y después sus coordenadas; no obtiene tu posición GPS. Referencias: [geocodificación](https://open-meteo.com/en/docs/geocoding-api) y [previsión](https://open-meteo.com/en/docs).
