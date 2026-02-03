const express = require('express');
const authMiddleware = require('../middleware/auth');

const createMesasRoutes = (db) => {
    const router = express.Router();

    // Proteger todas las rutas de mesas (Admin only)
    router.use(authMiddleware);

    // GET /api/mesas - Obtener todas las mesas del restaurante del usuario
    router.get('/', async (req, res) => {
        try {
            const restauranteId = req.usuario.restaurante_id;
            const mesas = await db.all("SELECT * FROM Mesas WHERE restaurante_id = ? ORDER BY numero_mesa ASC", [restauranteId]);
            res.json(mesas);
        } catch (error) {
            console.error('Error al obtener mesas:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    });

    // POST /api/mesas - Crear nueva mesa
    router.post('/', async (req, res) => {
        const { numero_mesa } = req.body;

        if (!numero_mesa) {
            return res.status(400).json({ error: 'El número de mesa es obligatorio' });
        }

        try {
            const restauranteId = req.usuario.restaurante_id;

            const result = await db.run(
                "INSERT INTO Mesas (numero_mesa, restaurante_id) VALUES (?, ?)",
                [numero_mesa, restauranteId]
            );

            res.status(201).json({ id: result.lastID, numero_mesa, restaurante_id: restauranteId });
        } catch (error) {
            console.error('Error al crear mesa:', error);
            if (error.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Ya existe una mesa con ese número' });
            }
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    });

    // DELETE /api/mesas/:id - Eliminar mesa
    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const restauranteId = req.usuario.restaurante_id;

            // Verificar que la mesa pertenece al restaurante
            const mesa = await db.get("SELECT id FROM Mesas WHERE id = ? AND restaurante_id = ?", [id, restauranteId]);
            if (!mesa) {
                return res.status(403).json({ error: 'No tienes permiso o la mesa no existe' });
            }

            await db.run("DELETE FROM Mesas WHERE id = ?", [id]);
            res.json({ message: 'Mesa eliminada correctamente' });
        } catch (error) {
            console.error('Error al eliminar mesa:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    });

    return router;
};

module.exports = createMesasRoutes;
