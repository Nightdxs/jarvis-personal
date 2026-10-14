# Referencias y decisiones

[Volver al inicio](../README.md)

## Tutoriales que inspiraron el proyecto

| Fuente | Ideas utilizadas | Material consultado |
| --- | --- | --- |
| [Cómo Crear tu Propio JARVIS con ChatGPT](https://www.youtube.com/watch?v=XMJiZuEg__Y), José Manuel · IA & Dev | Identidad, memoria Markdown/Obsidian, preferencias de diseño, webs, publicación y domótica. | Descripción y capítulos públicos; no pudo recuperarse su transcripción. |
| [Cómo crear tu propio JARVIS de Iron Man con IA usando Claude Code](https://www.youtube.com/watch?v=zl5yAFrJa24), IA Labs | Organización del contexto, voz, instrucciones de proyecto y tarjetas de información. | Transcripción automática, que puede contener errores. |

La aplicación es una implementación propia de esas ideas. No reproduce exactamente los tutoriales ni redistribuye sus videos, audio o transcripciones. La adaptación actual usa Codex con ChatGPT para respetar la decisión de no contratar consumo adicional de API. Realtime se conserva en el código anterior, pero queda bloqueado.

La selección de contexto, los límites de archivo, las copias revisables y la aprobación única son decisiones de esta implementación. No se promete un porcentaje fijo de ahorro de tokens ni una voz idéntica a la de una película.

## Documentación de proveedores

- OpenAI: [autenticación de Codex](https://learn.chatgpt.com/docs/auth), [CLI](https://learn.chatgpt.com/docs/cli), [referencia de ejecución](https://learn.chatgpt.com/docs/cli/reference) y [planes/límites](https://learn.chatgpt.com/docs/pricing).
- Microsoft: [dictado de Windows](https://support.microsoft.com/en-us/accessibility/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc).
- Brave: [limitación del reconocimiento web](https://github.com/brave/brave-browser/issues/2802).
- GitHub: [repositorios](https://docs.github.com/en/rest/repos/repos#create-a-repository-for-the-authenticated-user) y [contenido](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents).
- Vercel: [API de despliegues](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment).
- Home Assistant: [API REST](https://developers.home-assistant.io/docs/api/rest/).
- Open-Meteo: [geocodificación](https://open-meteo.com/en/docs/geocoding-api) y [previsión](https://open-meteo.com/en/docs).
- Tailscale: [Serve](https://tailscale.com/docs/features/tailscale-serve).

Las versiones, disponibilidad y condiciones de servicios externos pueden cambiar. Consulta sus fuentes actuales cuando configures una integración.
