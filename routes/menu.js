/*
 * ==========================================================
 * ARCHIVO: routes/menu.js
 * PROPÓSITO: Rutas para gestionar el menú (Categorías, Platos, Modificadores).
 * ==========================================================
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.js');

function createMenuRoutes(db) {

  /*
   * =============================================================
   * RUTA 1: Crear una nueva categoría
   * POST /api/menu/categorias
   * =============================================================
   */
  router.post('/categorias', authMiddleware, async (req, res) => {
    try {
      const { nombre_categoria } = req.body;
      if (!nombre_categoria) {
        return res.status(400).json({ error: 'El campo "nombre_categoria" es requerido.' });
      }
      const restauranteId = req.usuario.restaurante_id;
      const nuevaCategoria = await db.run(
        "INSERT INTO Categorias (nombre_categoria, restaurante_id) VALUES (?, ?)",
        [nombre_categoria, restauranteId]
      );
      res.status(201).json({
        message: 'Categoría creada con éxito.',
        categoriaId: nuevaCategoria.lastID,
        nombre: nombre_categoria
      });
    } catch (error) {
      if (error.message.includes('unique constraint')) {
        return res.status(409).json({ error: 'Esa categoría ya existe en tu restaurante.' });
      }
      console.error('Error en /categorias POST:', error.message);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  /*
   * =============================================================
   * RUTA 2: Obtener TODAS mis categorías
   * GET /api/menu/categorias
   * =============================================================
   */
  router.get('/categorias', authMiddleware, async (req, res) => {
    try {
      const restauranteId = req.usuario.restaurante_id;
      const categorias = await db.all(
        "SELECT * FROM Categorias WHERE restaurante_id = ? ORDER BY nombre_categoria",
        [restauranteId]
      );
      res.status(200).json(categorias);
    } catch (error) {
      console.error('Error en /categorias GET:', error.message);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });
  /*
   * =============================================================
   * RUTA 2.5: Eliminar una categoría
   * DELETE /api/menu/categorias/:id
   * =============================================================
   */
  router.delete('/categorias/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const restauranteId = req.usuario.restaurante_id;

      // 1. Verificar que la categoría pertenece al restaurante
      const categoria = await db.get(
        "SELECT id FROM Categorias WHERE id = ? AND restaurante_id = ?",
        [id, restauranteId]
      );

      if (!categoria) {
        return res.status(403).json({ error: 'No tienes permiso o no existe la categoría.' });
      }

      // 2. Verificar si tiene platos asociados
      const platos = await db.all("SELECT id FROM Platos WHERE categoria_id = ?", [id]);
      if (platos.length > 0) {
        return res.status(400).json({ error: 'No se puede eliminar: La categoría tiene platos asociados.' });
      }

      // 3. Eliminar
      await db.run("DELETE FROM Categorias WHERE id = ?", [id]);
      res.json({ message: 'Categoría eliminada.' });
    } catch (error) {
      console.error('Error al eliminar categoría:', error);
      res.status(500).json({ error: 'Error interno.' });
    }
  });

  /*
   * =============================================================
   * RUTA 3: Añadir un nuevo plato al menú
   * POST /api/menu/platos
   * =============================================================
   */
  router.post('/platos', authMiddleware, async (req, res) => {
    try {
      const { nombre_plato, descripcion, precio, categoria_id } = req.body;
      if (!nombre_plato || !precio || !categoria_id) {
        return res.status(400).json({ error: 'Faltan campos (nombre_plato, precio, categoria_id).' });
      }
      const restauranteId = req.usuario.restaurante_id;

      // Verificamos que la categoría le pertenece a este restaurante
      const categoria = await db.get(
        "SELECT id FROM Categorias WHERE id = ? AND restaurante_id = ?",
        [categoria_id, restauranteId]
      );
      if (!categoria) {
        return res.status(403).json({ error: 'Permiso denegado. Esa categoría no pertenece a tu restaurante.' });
      }

      const nuevoPlato = await db.run(
        "INSERT INTO Platos (nombre_plato, descripcion, precio, categoria_id) VALUES (?, ?, ?, ?)",
        [nombre_plato, descripcion, precio, categoria_id]
      );
      res.status(201).json({
        message: 'Plato creado con éxito.',
        platoId: nuevoPlato.lastID
      });
    } catch (error) {
      console.error('Error en /platos POST:', error.message);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  /*
   * =============================================================
   * RUTA 4: Eliminar un plato
   * DELETE /api/menu/platos/:id
   * =============================================================
   */
  router.delete('/platos/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const restauranteId = req.usuario.restaurante_id;

      // Verificar propiedad (Join con Categorías)
      const plato = await db.get(
        `SELECT p.id FROM Platos p 
             JOIN Categorias c ON p.categoria_id = c.id 
             WHERE p.id = ? AND c.restaurante_id = ?`,
        [id, restauranteId]
      );

      if (!plato) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar este plato o no existe.' });
      }

      await db.run("DELETE FROM Platos WHERE id = ?", [id]);
      res.json({ message: 'Plato eliminado.' });

    } catch (error) {
      console.error('Error en /platos DELETE:', error.message);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  /*
   * =============================================================
   * --- NUEVA RUTA 4: Añadir un Modificador a un Plato ---
   * POST /api/menu/modificadores
   * =============================================================
   * Esta ruta está protegida. Debemos verificar que el plato
   * al que se añade el modificador PERTENECE al restaurante del dueño.
   */
  router.post('/modificadores', authMiddleware, async (req, res) => {
    try {
      // 1. Obtener los datos
      const { nombre_modificador, precio_extra, plato_id } = req.body;
      if (!nombre_modificador || !plato_id) {
        return res.status(400).json({ error: 'Faltan campos (nombre_modificador, plato_id).' });
      }

      // 2. Obtener el ID del restaurante (del token)
      const restauranteId = req.usuario.restaurante_id;

      // 3. --- ¡VERIFICACIÓN DE SEGURIDAD! ---
      // Verificamos que el plato (plato_id) le pertenece a este restaurante.
      // Lo hacemos revisando si el plato pertenece a una categoría que le pertenece al restaurante.
      const plato = await db.get(
        `SELECT Platos.id 
         FROM Platos 
         JOIN Categorias ON Platos.categoria_id = Categorias.id
         WHERE Platos.id = ? AND Categorias.restaurante_id = ?`,
        [plato_id, restauranteId]
      );

      if (!plato) {
        // Si no se encuentra, es un intruso o un error
        return res.status(403).json({ error: 'Permiso denegado. Ese plato no pertenece a tu restaurante.' });
      }

      // 4. Si todo está bien, insertamos el modificador
      const nuevoModificador = await db.run(
        "INSERT INTO Modificadores (nombre_modificador, precio_extra, plato_id) VALUES (?, ?, ?)",
        [nombre_modificador, precio_extra || 0.00, plato_id] // || 0.00 hace que precio_extra sea opcional
      );

      res.status(201).json({
        message: 'Modificador creado con éxito.',
        modificadorId: nuevoModificador.lastID
      });

    } catch (error) {
      console.error('Error en /modificadores POST:', error.message);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  return router;
}

module.exports = createMenuRoutes;