# Voz y dictado

[Volver al inicio](../README.md)

## Escuchar a JARVIS

El selector Voz de JARVIS enumera las voces de `speechSynthesis` disponibles en el sistema/navegador y coloca primero las de español. Automática elige la primera voz en español; si no hay una, depende de la voz predeterminada del navegador.

Pulsa Probar voz para reproducir una frase breve. Marca Leer respuestas para escuchar las respuestas nuevas. La lectura se limita a los primeros 5.000 caracteres de cada respuesta. Desmarcar la opción detiene la lectura actual.

Puedes ajustar Tono entre 0,5 y 1,5 y Velocidad entre 0,6 y 1,4. Grave y pausada selecciona Raúl en español si está disponible y aplica tono 0,8 y velocidad 0,9. La selección, el tono y la velocidad se conservan en `localStorage` para ese origen y navegador; Leer respuestas se activa por sesión de página.

**No se incluye la voz exacta de Marvel ni una clonación de voz.** Estos ajustes modifican una voz instalada y el resultado depende del motor de síntesis. No se ha verificado por audición el parecido con ninguna interpretación cinematográfica.

## Dictar en un navegador compatible

1. Pulsa Dictar y autoriza el micrófono cuando el navegador lo solicite.
2. Habla en español; la configuración de reconocimiento usa `es-ES`.
3. El texto reconocido se añade al mensaje.
4. Revisa y pulsa Enviar.

El dictado no envía el mensaje automáticamente. No hay escucha permanente ni palabra de activación. El reconocimiento web puede utilizar un servicio del proveedor del navegador.

## Brave y el error network

Brave presenta [limitaciones documentadas en Web Speech](https://github.com/brave/brave-browser/issues/2802). En el equipo comprobado, Dictar devolvió `network`. Por ello, cuando detecta Brave, JARVIS enfoca el mensaje y muestra la alternativa de Windows en lugar de iniciar el reconocimiento web.

1. Pulsa Dictar · Win + H o Dictado Windows.
2. Presiona **Windows + H** físicamente.
3. Activa el micrófono en la barra de dictado de Windows y habla.
4. Revisa el texto y pulsa Enviar en JARVIS.

El botón de la página no abre el panel del sistema ni activa tu micrófono por sí mismo. [Windows Voice Typing](https://support.microsoft.com/en-us/accessibility/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc) utiliza reconocimiento en línea de Microsoft. No consume créditos de la API de OpenAI. Su funcionamiento y permisos deben comprobarse en cada PC.

## Errores

| Error | Qué comprobar |
| --- | --- |
| `network` | Servicio web no disponible; usa la alternativa de Windows. |
| `not-allowed` | Permiso de micrófono de la página y configuración de privacidad de Windows. |
| `service-not-allowed` | El navegador no permite ese servicio; usa dictado de Windows. |
| `audio-capture` | Micrófono conectado, habilitado y seleccionado. |
| `no-speech` | No se detectó voz; vuelve a intentar cerca del micrófono. |

Realtime de OpenAI sigue bloqueado. La alternativa actual es dictado → texto → respuesta → lectura, con turnos explícitos.
