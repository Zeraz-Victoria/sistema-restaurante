/*
 * ==========================================================
 * ARCHIVO: routes/auth.js
 * PROPÓSITO: Manejar el registro y login de usuarios (Dueños).
 * ==========================================================
 */

const express = require('express');
const bcrypt = require('bcrypt'); // Para encriptar contraseñas
const jwt = require('jsonwebtoken'); // Para crear los "tokens" de sesión
require('dotenv').config(); // Carga el JWT_SECRET desde .env

const router = express.Router(); // Creamos un "mini-servidor" para las rutas

// Esta función "fábrica" nos permite pasar la conexión 'db' desde servidor.js
function createAuthRoutes(db) {

  /*
   * =============================================
   * RUTA DE REGISTRO (POST /api/auth/register)
   * =============================================
   * Para que TÚ (Superadmin) crees un nuevo restaurante y su dueño.
   * PROTEGIDO: Requiere 'x-admin-secret' en headers.
   */
  router.post('/register', async (req, res) => {
    try {
      const { nombre_restaurante, slug, email_dueño, password_dueño } = req.body;
      const adminSecret = req.headers['x-admin-secret'];

      // 0. Seguridad: Verificar que sea el Superadmin
      if (adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere clave de administrador.' });
      }

      // 1. Validar que tengamos todos los datos
      if (!nombre_restaurante || !email_dueño || !password_dueño) {
        return res.status(400).json({ error: 'Faltan datos para el registro.' });
      }

      // 2. Encriptar la contraseña (¡NUNCA guardar contraseñas en texto plano!)
      const salt = await bcrypt.genSalt(10); // Genera una "sal" para la encriptación
      const password_hash = await bcrypt.hash(password_dueño, salt);

      // 3. Crear el Restaurante
      // Usamos "RETURNING id" para que la BD nos devuelva el ID del restaurante recién creado
      const nuevoRestaurante = await db.run(
        "INSERT INTO Restaurantes (nombre_restaurante, slug) VALUES (?, ?)",
        [nombre_restaurante, slug || nombre_restaurante?.toLowerCase().replace(/\s+/g, '-')]
      );
      const restauranteId = nuevoRestaurante.lastID; // Obtenemos el ID

      // 4. Crear el Usuario "Dueño" vinculado a ese restaurante
      await db.run(
        "INSERT INTO Usuarios (email, password_hash, rol, restaurante_id) VALUES (?, ?, ?, ?)",
        [email_dueño, password_hash, 'dueño', restauranteId]
      );

      res.status(201).json({
        message: 'Restaurante y dueño creados con éxito.',
        restauranteId: restauranteId,
        email: email_dueño
      });

    } catch (error) {
      // Manejar error si el email o nombre de restaurante ya existe
      if (error.message.includes('unique constraint')) {
        return res.status(409).json({ error: 'El email o el nombre del restaurante ya existen.' });
      }
      console.error('Error en /register:', error.message);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  /*
   * =============================================
   * RUTA DE LOGIN (POST /api/auth/login)
   * =============================================
   * Para que un dueño (u otro rol) inicie sesión.
   */
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      // 1. Buscar al usuario por su email
      const usuario = await db.get(
        `SELECT u.*, r.slug 
         FROM Usuarios u 
         LEFT JOIN Restaurantes r ON u.restaurante_id = r.id 
         WHERE u.email = ?`,
        [email]
      );
      if (!usuario) {
        return res.status(401).json({ error: 'Credenciales incorrectas (email).' });
      }

      // 2. Comparar la contraseña que nos mandan con la encriptada en la BD
      const esPasswordCorrecta = await bcrypt.compare(password, usuario.password_hash);
      if (!esPasswordCorrecta) {
        return res.status(401).json({ error: 'Credenciales incorrectas (password).' });
      }

      // 3. ¡ÉXITO! Creamos la "llave" (Token JWT)
      // Este token es una credencial digital que el frontend guardará.
      const payload = {
        id: usuario.id,
        rol: usuario.rol,
        restaurante_id: usuario.restaurante_id,
        slug: usuario.slug
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET, // Nuestra clave secreta del .env
        { expiresIn: '1d' } // El token expira en 1 día
      );

      // 4. Enviar el token al frontend
      res.status(200).json({
        message: 'Login exitoso.',
        token: token,
        usuario: payload // Enviamos también los datos del usuario
      });

    } catch (error) {
      console.error('Error en /login:', error.message);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  return router; // Devolvemos el "mini-servidor" configurado
}

// Exportamos la función "fábrica"
module.exports = createAuthRoutes;