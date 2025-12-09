/*
 * ==========================================================
 * ARCHIVO: middleware/auth.js
 * PROPÓSITO: El "guardia" que protege nuestras rutas.
 * ==========================================================
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Este es el middleware de autenticación.
 * Se ejecutará en cada ruta que queramos proteger.
 */
const authMiddleware = (req, res, next) => {
  try {
    // 1. Obtener el token del "encabezado" (header) de la petición
    // El frontend lo enviará así: "Authorization: Bearer <token>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extrae solo el token

    if (!token) {
      // 2. Si no hay token, rechazar la petición
      return res.status(401).json({ error: 'Acceso denegado. No se proporcionó token.' });
    }

    // 3. Verificar si el token es válido y no ha expirado
    // jwt.verify descifra el token usando nuestra clave secreta
    const payload = jwt.verify(token, JWT_SECRET);

    // 4. ¡Éxito! El token es válido.
    // Adjuntamos los datos del usuario (el payload) al objeto 'req'
    // para que la siguiente función (la ruta real) pueda usarlos.
    req.usuario = payload;

    // 5. Dejar pasar la petición al siguiente nivel (la ruta)
    next();

  } catch (error) {
    // Si el token es inválido (mal firmado, expirado), jwt.verify dará un error
    console.error('Error de autenticación:', error.message);
    res.status(403).json({ error: 'Token inválido o expirado.' });
  }
};

module.exports = authMiddleware; // Exportamos solo la función