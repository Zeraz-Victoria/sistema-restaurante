/*
 * ==========================================================
 * ARCHIVO: routes/tenants.js
 * PROPÓSITO: API CRUD para gestionar Inquilinos (Restaurantes).
 * PROTECCIÓN: Solo Super Admin (implementación futura).
 * ==========================================================
 */

const express = require('express');
const router = express.Router();

function createTenantsRoutes(db) {

    // Middleware de protección: Requiere 'x-admin-secret' para TODAS las rutas de /tenants
    router.use((req, res, next) => {
        const adminSecret = req.headers['x-admin-secret'];
        if (adminSecret !== process.env.ADMIN_SECRET) {
            return res.status(403).json({ error: 'Acceso denegado. Se requiere clave de administrador.' });
        }
        next();
    });

    // GET /api/tenants - Listar todos los restaurantes
    router.get('/', async (req, res) => {
        try {
            const tenants = await db.all("SELECT * FROM Restaurantes");
            res.json(tenants);
        } catch (error) {
            console.error('Error al listar tenants:', error);
            res.status(500).json({ error: 'Error interno' });
        }
    });

    // POST /api/tenants - Crear nuevo restaurante
    router.post('/', async (req, res) => {
        const { nombre_restaurante, slug, plan_activo_hasta, admin_email, admin_password } = req.body;

        if (!nombre_restaurante || !slug) {
            return res.status(400).json({ error: 'Nombre y Slug son requeridos' });
        }

        try {
            const result = await db.run(
                "INSERT INTO Restaurantes (nombre_restaurante, slug, plan_activo_hasta) VALUES (?, ?, ?)",
                [nombre_restaurante, slug, plan_activo_hasta || '2025-12-31']
            );

            const restauranteId = result.lastID;

            // Crear categoría por defecto "General"
            await db.run(
                "INSERT INTO Categorias (nombre_categoria, restaurante_id) VALUES (?, ?)",
                ['General', restauranteId]
            );

            // Crear Usuario Admin
            const bcrypt = require('bcrypt');
            const passwordToHash = admin_password || '123456';
            const hashedPassword = await bcrypt.hash(passwordToHash, 10);

            // Si el usuario proveyó email, úsalo. Si no, genera uno por defecto.
            const email = admin_email || `admin@${slug}.com`;

            await db.run(
                "INSERT INTO Usuarios (email, password_hash, rol, restaurante_id) VALUES (?, ?, ?, ?)",
                [email, hashedPassword, 'dueño', restauranteId]
            );

            res.status(201).json({
                id: restauranteId,
                message: 'Restaurante creado con éxito',
                credentials: {
                    email: email,
                    password: passwordToHash
                }
            });
        } catch (error) {
            if (error.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Nombre, Slug o Email ya existen' });
            }
            console.error('Error al crear tenant:', error);
            res.status(500).json({ error: 'Error interno: ' + error.message });
        }
    });

    // PUT /api/tenants/:id/credentials - Actualizar credenciales del Admin
    router.put('/:id/credentials', async (req, res) => {
        const { id } = req.params;
        const { email, password } = req.body;

        if (!email && !password) {
            return res.status(400).json({ error: 'Email o Password requeridos' });
        }

        try {
            const bcrypt = require('bcrypt');

            // Buscar usuario dueño del restaurante
            const usuario = await db.get("SELECT id FROM Usuarios WHERE restaurante_id = ? AND rol = 'dueño'", [id]);

            if (!usuario) {
                return res.status(404).json({ error: 'Usuario administrador no encontrado para este restaurante' });
            }

            if (email) {
                await db.run("UPDATE Usuarios SET email = ? WHERE id = ?", [email, usuario.id]);
            }
            if (password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                await db.run("UPDATE Usuarios SET password_hash = ? WHERE id = ?", [hashedPassword, usuario.id]);
            }

            res.json({ message: 'Credenciales actualizadas correctamente' });
        } catch (error) {
            if (error.message.includes('UNIQUE')) {
                return res.status(409).json({ error: 'El email ya está en uso' });
            }
            console.error('Error al actualizar credenciales:', error);
            res.status(500).json({ error: 'Error interno' });
        }
    });

    // PUT /api/tenants/:id - Actualizar restaurante
    router.put('/:id', async (req, res) => {
        const { id } = req.params;
        const { nombre_restaurante, slug, plan_activo_hasta } = req.body;

        try {
            await db.run(
                "UPDATE Restaurantes SET nombre_restaurante = ?, slug = ?, plan_activo_hasta = ? WHERE id = ?",
                [nombre_restaurante, slug, plan_activo_hasta, id]
            );
            res.json({ message: 'Restaurante actualizado' });
        } catch (error) {
            console.error('Error al actualizar tenant:', error);
            res.status(500).json({ error: 'Error interno' });
        }
    });

    // DELETE /api/tenants/:id - Borrar restaurante y toda su data
    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        try {
            // Eliminar dependencias en ORDEN CORRECTO (de hijos a padres)

            // 1. DetalleModificadores (depende de DetallePedidos y Modificadores)
            await db.run(`
                DELETE FROM DetalleModificadores 
                WHERE detalle_pedido_id IN (
                    SELECT dp.id FROM DetallePedidos dp
                    JOIN Pedidos p ON dp.pedido_id = p.id
                    WHERE p.restaurante_id = ?
                )
            `, [id]);

            // 2. DetallePedidos (depende de Pedidos y Platos)
            await db.run(`
                DELETE FROM DetallePedidos 
                WHERE pedido_id IN (SELECT id FROM Pedidos WHERE restaurante_id = ?)
            `, [id]);

            // 3. Pedidos (depende de Restaurante y Mesas)
            await db.run("DELETE FROM Pedidos WHERE restaurante_id = ?", [id]);

            // 4. Modificadores (depende de Platos)
            await db.run(`
                DELETE FROM Modificadores 
                WHERE plato_id IN (
                    SELECT p.id FROM Platos p
                    JOIN Categorias c ON p.categoria_id = c.id
                    WHERE c.restaurante_id = ?
                )
            `, [id]);

            // 5. Platos (depende de Categorias)
            await db.run(`
                DELETE FROM Platos 
                WHERE categoria_id IN (SELECT id FROM Categorias WHERE restaurante_id = ?)
            `, [id]);

            // 6. Categorias
            await db.run("DELETE FROM Categorias WHERE restaurante_id = ?", [id]);

            // 7. Mesas
            await db.run("DELETE FROM Mesas WHERE restaurante_id = ?", [id]);

            // 8. Usuarios
            await db.run("DELETE FROM Usuarios WHERE restaurante_id = ?", [id]);

            // 9. Restaurante
            await db.run("DELETE FROM Restaurantes WHERE id = ?", [id]);

            res.json({ message: 'Restaurante y todos sus datos eliminados correctamente' });
        } catch (error) {
            console.error('Error al eliminar tenant:', error);
            res.status(500).json({ error: 'Error interno al eliminar datos asociados: ' + error.message });
        }
    });

    return router;
}

module.exports = createTenantsRoutes;
