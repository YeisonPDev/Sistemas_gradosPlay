# Control de Grados

Aplicación web para registrar la **asistencia de los acudientes a la ceremonia de grados** de un colegio.

Cada estudiante tiene hasta dos acudientes. Desde el panel, el personal del colegio marca quién llegó, y los cambios se ven **en tiempo real** en todos los dispositivos conectados, de modo que varias personas pueden registrar asistencia al mismo tiempo desde distintas entradas.

## Funcionalidades

- **Inicio de sesión** con usuario y contraseña (contraseñas cifradas con bcrypt).
- **Listado de estudiantes** con sus dos acudientes y un interruptor de asistencia para cada uno.
- **Sincronización en tiempo real** entre todos los usuarios conectados.
- **Búsqueda** por nombre de estudiante, acudiente o código.
- **Estadísticas** de asistencia, que también funcionan como filtros:
  - ambos acudientes asistieron
  - solo uno asistió
  - ninguno asistió
  - total de estudiantes
- **Indicador de color** por fila según el estado de asistencia (verde, naranja o rojo).
- **Confirmación** antes de cambiar un acudiente a "no asistió".
- Diseño **responsive**: en celular, la tabla se muestra como tarjetas.

## Tecnologías

| Capa | Herramienta |
|---|---|
| Servidor | Node.js + Express 5 |
| Vistas | EJS |
| Base de datos | Supabase (PostgreSQL) |
| Tiempo real | Supabase Realtime (broadcast) |
| Sesiones | express-session |
| Contraseñas | bcryptjs |

## Estructura del proyecto

```
├── server.js              # Servidor Express: rutas, login, sesiones y API
├── supabaseClient.js      # Cliente de Supabase (clave secreta, solo en el servidor)
├── views/
│   ├── login.ejs          # Pantalla de inicio de sesión
│   └── dashboard.ejs      # Panel de asistencia
├── public/
│   ├── css/
│   │   ├── base.css       # Variables, reset y estilos compartidos
│   │   ├── login.css      # Estilos del login
│   │   └── dashboard.css  # Estilos del panel
│   ├── js/
│   │   ├── login.js       # Mostrar u ocultar contraseña
│   │   └── dashboard.js   # Búsqueda, filtros, estadísticas y tiempo real
│   └── img/
│       └── cursos-logo.jpg
├── scripts/
│   └── hash-passwords.js  # Cifra las contraseñas que estén en texto plano
├── supabase/
│   └── security.sql       # Bloquea el acceso público a las tablas (RLS)
└── vercel.json            # Configuración para desplegar en Vercel
```

## Instalación

**Requisitos:** Node.js 18 o superior y un proyecto en [Supabase](https://supabase.com).

1. Clona el repositorio e instala las dependencias:

   ```bash
   git clone https://github.com/YeisonPDev/Sistemas_gradosPlay.git
   cd Sistemas_gradosPlay
   npm install
   ```

2. Crea un archivo `.env` en la raíz del proyecto:

   ```env
   PORT=3000
   SUPABASE_URL=https://TU-PROYECTO.supabase.co
   SUPABASE_KEY=sb_secret_...            # Clave secreta: solo para el servidor
   SUPABASE_ANON_KEY=sb_publishable_...  # Clave publicable: se envía al navegador
   SESSION_SECRET=una-cadena-larga-y-aleatoria
   ```

   Para generar un `SESSION_SECRET`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   > **Importante:** el archivo `.env` nunca debe subirse al repositorio (ya está en `.gitignore`).

3. En Supabase, ejecuta [`supabase/security.sql`](supabase/security.sql) desde el **SQL Editor**.

4. Inicia el servidor:

   ```bash
   npm run dev     # desarrollo (se reinicia al guardar cambios)
   npm start       # producción
   ```

   Luego abre `http://localhost:3000`.

## Base de datos

**Tabla `users`**

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigint | Identificador |
| `user` | varchar | Nombre de usuario para iniciar sesión |
| `nombre` | varchar | Nombre que se muestra en el panel |
| `contraseña` | varchar | Hash bcrypt de la contraseña |

**Tabla `grados`**

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigint | Identificador |
| `Estudiante` | text | Nombre del estudiante |
| `Codigo` | numeric | Código del estudiante |
| `Acudiente_1` | text | Nombre del primer acudiente |
| `Acudiente_2` | text | Nombre del segundo acudiente |
| `estado1` | boolean | Asistencia del acudiente 1 |
| `estado2` | boolean | Asistencia del acudiente 2 |

### Cifrar contraseñas

Si agregas usuarios con la contraseña en texto plano, ejecuta:

```bash
npm run hash-passwords
```

El script cifra con bcrypt las contraseñas pendientes y omite las que ya están cifradas. Además, una contraseña en texto plano se cifra automáticamente la primera vez que ese usuario inicia sesión.

## Seguridad

- La **clave secreta** de Supabase solo se usa en el servidor; el navegador recibe únicamente la clave publicable.
- Las tablas tienen **Row Level Security** activado, por lo que la clave publicable no puede leerlas ni modificarlas.
- El navegador no consulta la base de datos: el servidor envía un aviso en tiempo real que contiene solo el `id` y los estados de asistencia, sin datos personales.
- Contraseñas cifradas con **bcrypt**; la sesión no guarda la contraseña.
- Cookies de sesión `httpOnly`, `sameSite` y `secure` en producción, con expiración de 8 horas.
- Validación de datos en la API de actualización.

## Autor

Desarrollado por **Yeison** — [@YeisonPDev](https://github.com/YeisonPDev)
