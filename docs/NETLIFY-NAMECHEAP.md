# Publicar Cheers: Netlify + Supabase + Namecheap

## Antes de comenzar

Necesitas cuentas gratuitas en GitHub, Netlify y Supabase. Namecheap solo se necesita cuando vayas a comprar el dominio.

## 1. Crear la base de datos

1. Entra a Supabase y crea un proyecto gratuito llamado `cheers`.
2. Guarda la contraseña de la base de datos en un lugar seguro.
3. Abre **SQL Editor** → **New query**.
4. Copia todo el contenido de `supabase/schema.sql`, ejecútalo y confirma que no muestre errores.
5. En **Project Settings** → **API**, deja abierta la pantalla: allí estarán la URL y las claves para configurarlas después en Netlify.

## 2. Subir la carpeta a GitHub

1. En GitHub usa **New repository**.
2. Nombre: `cheers-cafe-bar`.
3. Selecciona **Private**.
4. Sube el contenido de la carpeta de Cheers. No subas archivos `.env` ni claves.

## 3. Crear la página de prueba

1. Entra a Netlify → **Add new site** → **Import an existing project**.
2. Conecta GitHub y elige `cheers-cafe-bar`.
3. Netlify detectará `netlify.toml`. No cambies el comando ni la carpeta de publicación.
4. En **Site configuration** → **Environment variables**, crea las variables de `.env.example` usando los valores de Supabase.
5. Pulsa **Deploy site**. Netlify entregará un enlace `nombre.netlify.app`.

## 4. Terminar la conexión de datos

La carpeta ya incluye la configuración de Netlify, el esquema de Supabase y la construcción protegida que evita publicar el archivo local de ventas. Antes de abrir el enlace al público, vuelve a Cheers con el enlace de Netlify y la URL de Supabase: se conecta la migración final de pedidos, inventario, usuarios y productos a tu proyecto.

## 5. Comprar y conectar el dominio

1. En Namecheap busca el nombre que quieras. No compres todavía sin revisar primer año, renovación e impuestos.
2. Cuando compres, en Netlify ve a **Domain management** → **Add a domain** y agrega el dominio.
3. Netlify te mostrará los registros DNS exactos.
4. En Namecheap abre **Domain List** → **Manage** → **Advanced DNS** y copia exactamente esos registros.
5. Espera la verificación. Puede tardar hasta 24–48 horas.
6. Comprueba que funcionen tanto `tudominio.com` como `www.tudominio.com`.

## Instalar como app

Con el dominio funcionando por HTTPS, abre la web en el celular. En Android usa **Instalar app**. En iPhone: Compartir → **Agregar a pantalla de inicio**.
