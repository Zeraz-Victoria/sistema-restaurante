/*
 * ==========================================================
 * ARCHIVO: servidor.js (CON SOCKET.IO Y COCINA)
 * ==========================================================
 */

const express = require('express');
const cors = require('cors');
const http = require('http'); // Necesario para Socket.io
const { Server } = require('socket.io'); // La magia del tiempo real
const { setupDatabase } = require('./database'); // Importamos el setup de la BD
require('dotenv').config();

// Importamos las rutas modulares
const createAuthRoutes = require('./routes/auth');
const createMenuRoutes = require('./routes/menu');
const createPedidosRoutes = require('./routes/pedidos');
const createPublicRoutes = require('./routes/public');
const createTenantsRoutes = require('./routes/tenants');

const app = express();
const port = process.env.PORT || 3000;

// --- CONFIGURACIÓN DE SOCKET.IO ---
const server = http.createServer(app); // Envolvemos la app de Express
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Servir archivos estáticos (Frontend)

// Evento de conexión
io.on('connection', (socket) => {
    console.log('🔌 Alguien se conectó (Socket ID:', socket.id, ')');

    // Unirse a la sala de un restaurante específico
    socket.on('join_room', (room) => {
        console.log(`[DEBUG] Attempting to join room: ${room} (Socket: ${socket.id})`);
        socket.join(room);
        console.log(`[DEBUG] Socket ${socket.id} se unió a la sala: ${room}`);
        console.log(`[DEBUG] Socket ${socket.id} rooms:`, socket.rooms);
    });
});

// --- INICIALIZACIÓN DE LA BASE DE DATOS Y RUTAS ---
(async () => {
    try {
        // 1. Inicializar la Base de Datos
        const db = await setupDatabase();

        // 2. Configurar las Rutas
        // Pasamos 'db' y 'io' a las rutas que lo necesiten
        app.use('/api/auth', createAuthRoutes(db));
        app.use('/api/menu', createMenuRoutes(db));
        app.use('/api/pedidos', createPedidosRoutes(db, io));
        app.use('/api/public', createPublicRoutes(db));
        app.use('/api/tenants', createTenantsRoutes(db));

        // Middleware de manejo de errores global
        app.use((err, req, res, next) => {
            console.error('❌ Error Global:', err.stack);
            res.status(500).json({ error: 'Algo salió mal en el servidor.' });
        });

        // 3. Arrancar el Servidor
        server.listen(port, () => {
            console.log(`\n🚀 Servidor (con Sockets) escuchando en http://localhost:${port}`);
        });

    } catch (error) {
        console.error('Error fatal al iniciar el servidor:', error);
    }
})();