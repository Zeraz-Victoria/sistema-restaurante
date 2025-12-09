/*
 * ==========================================================
 * ARCHIVO: routes/public.js
 * PROPÓSITO: Rutas públicas que CUALQUIERA puede consultar.
 * (No requieren autenticación).
 * ==========================================================
 */

const express = require('express');
const router = express.Router();

// Esta función "fábrica" nos permite pasar la conexión 'db'
function createPublicRoutes(db) {

  /*
   * =============================================================
   * RUTA PÚBLICA: Obtener el menú COMPLETO de UN restaurante
   * GET /api/public/menu?restaurante_id=1
   * =============================================================
   * Esta es la ruta que llamará el teléfono del cliente.
   * Le pasamos el ID del restaurante por la URL (query parameter).
   */
  /*
   * =============================================
   * RUTA PÚBLICA: Resolver SLUG a ID y Config
   * GET /api/public/config?slug=restaurante-demo
   * =============================================
   */
  router.get('/config', async (req, res) => {
    try {
      const { slug } = req.query;
      if (!slug) return res.status(400).json({ error: 'Slug requerido' });

      const restaurante = await db.get(
        "SELECT id, nombre_restaurante, slug FROM Restaurantes WHERE slug = ?",
        [slug]
      );

      if (!restaurante) {
        return res.status(404).json({ error: 'Restaurante no encontrado' });
      }

      res.json(restaurante);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error interno' });
    }
  });

  router.get('/menu', async (req, res) => {
    try {
      // 1. Obtenemos el ID del restaurante desde la URL
      const { restaurante_id } = req.query; // ej: ?restaurante_id=1

      if (!restaurante_id) {
        return res.status(400).json({ error: 'Falta el ID del restaurante.' });
      }

      // 2. Optimización: 3 Consultas en lugar de N+1
      // Consulta A: Categorías
      const categorias = await db.all(
        "SELECT * FROM Categorias WHERE restaurante_id = ? ORDER BY nombre_categoria",
        [restaurante_id]
      );

      if (!categorias || categorias.length === 0) {
        return res.status(404).json({ error: 'Menú no encontrado o vacío.' });
      }

      // Consulta B: Platos (Todos los de este restaurante)
      // Usamos el ID de las categorías para filtrar, o más simple: JOIN con categorías
      const platos = await db.all(
        `SELECT p.* 
         FROM Platos p 
         JOIN Categorias c ON p.categoria_id = c.id 
         WHERE c.restaurante_id = ? 
         ORDER BY p.nombre_plato`,
        [restaurante_id]
      );

      // Consulta C: Modificadores (Todos los de estos platos)
      const modificadores = await db.all(
        `SELECT m.*, p.categoria_id 
         FROM Modificadores m 
         JOIN Platos p ON m.plato_id = p.id 
         JOIN Categorias c ON p.categoria_id = c.id 
         WHERE c.restaurante_id = ? 
         ORDER BY m.nombre_modificador`,
        [restaurante_id]
      );

      // 3. Reensamblar en memoria (mucho más rápido que ir a la BD N veces)

      // Mapa para acceso rápido a modificadores por plato
      const modificadoresPorPlato = {};
      for (const mod of modificadores) {
        if (!modificadoresPorPlato[mod.plato_id]) {
          modificadoresPorPlato[mod.plato_id] = [];
        }
        modificadoresPorPlato[mod.plato_id].push(mod);
      }

      // Mapa para acceso rápido a platos por categoría
      const platosPorCategoria = {};
      for (const plato of platos) {
        plato.modificadores = modificadoresPorPlato[plato.id] || [];

        if (!platosPorCategoria[plato.categoria_id]) {
          platosPorCategoria[plato.categoria_id] = [];
        }
        platosPorCategoria[plato.categoria_id].push(plato);
      }

      // Asignar platos a categorías
      for (const cat of categorias) {
        cat.platos = platosPorCategoria[cat.id] || [];
      }

      // 5. Enviamos el JSON completo y anidado
      res.status(200).json(categorias);

    } catch (error) {
      console.error('Error en /public/menu GET:', error.message);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  return router;
}

module.exports = createPublicRoutes;