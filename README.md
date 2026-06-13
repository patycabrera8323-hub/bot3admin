# Nexus Admin App

Panel de administración autogestionable para dueños de negocios en la plataforma Nexus AI.

## Características

- ✅ Login / Registro de negocio
- ✅ Gestión de productos (CRUD)
- ✅ Historial de pedidos en tiempo real
- ✅ Gestión de promociones y combos
- ✅ Configuración del negocio (horario, pagos, envío mínimo)
- ✅ Conectado a Firebase Firestore (proyecto: bot-nuevo-bdf67)

## Uso local

```bash
npm install
npm start
# Abre http://localhost:3001
```

## Credenciales de prueba (modo local sin Firebase)

- Admin global: `admin@nexus.com` / `admin123`

## Despliegue

Este proyecto puede desplegarse en **Cloudflare Pages** o **Firebase Hosting** como sitio estático.
El archivo `server.js` sirve para pruebas locales únicamente.
