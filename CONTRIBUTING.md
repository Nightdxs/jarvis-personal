# Contribuir y editar

Lee [AGENTS.md](AGENTS.md) y la [arquitectura](docs/ARQUITECTURA.md) antes de modificar el código. Usa Node.js 22+, conserva el español y no añadas dependencias si el cambio no las necesita.

1. Crea una rama para tu cambio.
2. Edita únicamente los módulos relevantes.
3. Mantén la API de pago bloqueada en esta configuración.
4. Ejecuta `npm test` y los checks de sintaxis de los módulos modificados.
5. Revisa el panel si cambias HTML, CSS o JS del navegador.
6. Actualiza la documentación y explica el resultado observable del cambio.
7. Revisa los archivos preparados para no enviar secretos o datos personales.

```powershell
node --check server.mjs
node --check core.mjs
node --check codex-bridge.mjs
node --check public/app.js
npm test
git diff --cached
```

Las pruebas automatizadas de servicios externos deben usar simulaciones, salvo autorización específica para una prueba real. No ejecutes código generado por el modelo. Mantén la aprobación de acciones externas y el aislamiento de las vistas previas.

Los cambios de voz se pueden hacer en `public/app.js` y `public/index.html`. La personalidad del asistente se edita en `vault/IDENTIDAD.md` de cada instalación, no publicando el vault personal. Las capturas del repositorio deben usar una instancia limpia.

No se ha asignado una licencia de reutilización. Publicar el repositorio no establece automáticamente una licencia abierta; acuerda con el propietario los permisos antes de redistribuir derivados.
