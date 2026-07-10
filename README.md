# 🕵️ El Impostor — Juego Multijugador

Juego de palabras secretas tipo "Among Us" con modo **multijugador online** (cada jugador en su propio celular) y modo **local** (un solo dispositivo que se pasa por turnos).

---

## 📁 Estructura del proyecto

```
impostor/
├── server.js          ← Backend Node.js (WebSockets)
├── package.json       ← Dependencias del backend
├── node_modules/      ← (se genera al instalar)
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json   ← Dependencias del frontend
    └── src/
        ├── main.jsx
        └── App.jsx    ← Toda la app React
```

---

## ⚙️ Instalación

### 1. Backend (servidor WebSocket)

```bash
# Desde la carpeta raíz del proyecto
npm install

# Iniciar el servidor
node server.js
# → Servidor corriendo en http://localhost:3001
```

### 2. Frontend (app React)

```bash
# Entrar a la carpeta frontend
cd frontend

# Instalar dependencias
npm install

# Iniciar el servidor de desarrollo (accesible en la red local)
npm run dev
# → App en http://localhost:5173
# → También accesible desde la red local en http://TU_IP:5173
```

### 3. Configurar la IP para multijugador

Para que tus amigos se conecten desde sus celulares, necesitás que todos estén en la **misma red WiFi** y editar la línea del WS_URL en `frontend/src/App.jsx`:

```js
// Línea ~9 en App.jsx — cambiá localhost por tu IP local
const WS_URL = "ws://192.168.1.XXX:3001";
```

Para encontrar tu IP local:
- **Windows**: `ipconfig` en CMD → buscar "Dirección IPv4"
- **Mac/Linux**: `ifconfig` o `ip addr` → buscar la IP que empieza con 192.168.x.x o 10.x.x.x

Tus amigos entonces entran desde su celular a: `http://192.168.1.XXX:5173`

---

## 🎮 Modos de juego

### 🌐 Multijugador Online
- Uno crea la sala y comparte el código de 5 letras
- Los demás ingresan el código desde su celular
- El anfitrión configura categorías, impostores, tiempo y pistas
- Cada jugador **ve su propia palabra en su pantalla** (tocando para revelar/ocultar)
- Todos escriben su pista → marcan "listo" → se va a votación automáticamente
- Votación individual desde cada celular

### 📱 Modo Local
- Un solo dispositivo que se pasa por turnos
- Cada jugador toca la pantalla para ver su palabra (con opción de ocultar)
- Timer configurable para la ronda de pistas
- Votación uno por uno en el mismo dispositivo

---

## 🗂️ Categorías disponibles

| Categoría | Palabras |
|-----------|----------|
| ⚽ Jugadores de Fútbol | Messi, Ronaldo, Mbappé... |
| 🏆 Selecciones | Argentina, Brasil, Francia... |
| 🎬 Actores Famosos | Tom Hanks, DiCaprio, Jolie... |
| 📜 Personajes Históricos | Napoleón, Einstein, Gandhi... |
| 🪑 Objetos Cotidianos | Silla, Microondas, Paraguas... |
| 🦁 Animales | León, Pingüino, Axolotl... |
| 🌍 Países del Mundo | China, Alemania, Bolivia... |
| 🍕 Comidas del Mundo | Sushi, Asado, Ramen... |
| 🏅 Deportes | Fútbol, Golf, Escalada... |
| 🎸 Músicos Famosos | Michael Jackson, Beyoncé... |

---

## 🔧 Opciones de configuración

- **Cantidad de impostores**: 1, 2 o 3 (máximo la mitad de jugadores)
- **Pistas al impostor**: si están activas, el impostor sabe la categoría pero no la palabra
- **Tiempo de pistas**: 0 (sin límite) a 3 minutos, en pasos de 15 segundos
- **Categorías**: se pueden activar/desactivar individualmente
- **Palabras usadas**: no se repiten durante la sesión; se pueden reiniciar

---

## 🚀 Para producción (deploy)

Si querés hostear el juego online (no solo en red local):

1. **Backend**: deploy en Railway, Render, Fly.io u otro con soporte WebSocket
2. **Frontend**: deploy en Vercel o Netlify (con la variable WS_URL apuntando al backend)

### Variables de entorno
```bash
# Backend
PORT=3001   # Puerto del servidor (default: 3001)

# Frontend (en App.jsx, línea 9)
const WS_URL = "wss://tu-backend.railway.app";  # wss:// para HTTPS
```

---

## 🃏 Flujo de una ronda (multijugador)

```
Lobby → [Anfitrión inicia] → Cada jugador ve su palabra en su celular
→ Todos marcan "Listo" → Fase de pistas (timer opcional)
→ Votación individual → Resultado con palabra revelada
→ [Nueva ronda o volver al lobby]
```

Si el eliminado NO era el impostor, la ronda vuelve a empezar automáticamente con la opción de iniciar otra.

---

## 📝 Notas técnicas

- **Backend**: Node.js + Express + ws (WebSockets nativos) — sin base de datos, todo en memoria
- **Frontend**: React 18 + Vite — sin librerías de UI externas
- **Estado**: compartido via WebSocket en tiempo real, cada cliente recibe solo su información privada (rol, palabra)
- **Reconexión**: si un jugador pierde la conexión, el servidor mantiene su estado y puede reconectarse
