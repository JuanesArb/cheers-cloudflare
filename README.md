# Cheers

Base profesional para el sistema web de café bar.

## Inicio rápido

Ejecuta `node server.mjs` y abre `http://localhost:4173`.

La pantalla de barra/cocina queda en `http://localhost:4173/bar.html`.

## Módulos

- Menú QR y pedido por mesa / para llevar
- Pedido personalizable, solicitudes de mesa y seguimiento en vivo
- Pantallas de barra y cocina en tiempo real
- Caja (POS), inventario con recetas, entradas y movimientos
- Dashboard, reportes, usuarios y roles
- Instalable como app en celular (PWA)

## Pantallas

- Menú QR: `http://localhost:4173/?table=8`
- Barra/cocina: `http://localhost:4173/bar.html`
- Administración: `http://localhost:4173/admin.html`
- Seguimiento: se abre automáticamente al confirmar un pedido.

## Instalar en celular

Al publicar Cheers con HTTPS, el cliente verá **Instalar app** en el menú. En iPhone también puede usar Compartir → **Agregar a pantalla de inicio**.

La guía de implementación y despliegue está en `docs/ROADMAP.md`.

Para publicar con Netlify, Supabase y Namecheap sigue `docs/NETLIFY-NAMECHEAP.md`.
