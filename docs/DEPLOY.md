# Publicar Cheers

Esta versión local usa `data/store.json`. Antes de recibir pedidos reales por internet, se debe migrar esa información a Supabase u otra base de datos persistente; de otro modo, los datos dependerán del computador donde corre el servidor.

1. Crea un proyecto en Supabase y ejecuta `supabase/schema.sql` en su editor SQL.
2. Crea el proyecto web en Netlify, conecta esta carpeta y configura las tres claves de `.env.example`.
3. Configura autenticación por correo en Supabase y crea el primer usuario administrador.
4. En Netlify, añade el dominio elegido y sigue el registro DNS que mostrará la plataforma.
5. Abre el sitio desde un celular y usa **Instalar app**. La instalación funciona al publicarlo con HTTPS.

## Dominio

Opciones prioritarias: `cheerscafe.co`, `cheersbar.co`, `somoscheers.co`.

Antes de comprar se confirma: disponibilidad, precio del primer año, renovación, impuestos y total final. No se compra nada sin confirmación explícita.
