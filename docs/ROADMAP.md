# Ruta de Cheers

## Base actual

- Landing / menú QR mobile-first
- Pedidos persistentes de mesa / para llevar, con número de pedido y estados
- Pantalla de barra/cocina en vivo
- Administración: ventas, caja, inventario, recetas, mesas/QR y usuarios
- Inventario descontado al ingresar un pedido
- Sistema visual premium oscuro y dorado

## Antes de publicar

1. Migrar los datos locales a Supabase: autenticación, base de datos y tiempo real.
2. Añadir pagos, impresión de comandas, apertura/cierre de caja y compras de inventario.
3. Activar los roles reales (administrador, caja, barra, cocina) y auditoría.
4. Conectar el dominio y desplegar en Vercel.

## Dominio y hosting

Propuesta cuando el producto esté listo para publicar:

- Dominio: `cheerscafe.co` como primera opción; alternativas `cheersbar.co` y `somoscheers.co`.
- Hosting: Vercel para la web y Supabase para autenticación, datos y tiempo real.
- Antes de comprar: confirmar disponibilidad, duración, impuestos, renovación y precio final.
- No se hace ninguna compra sin aprobación explícita en el paso de pago.
