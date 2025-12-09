/*
 * ==========================================================
 * ARCHIVO: routes/pedidos.js
 * PROPÓSITO: Recibir pedidos del cliente y guardarlos.
 * ==========================================================
 */

const express = require('express');
const router = express.Router();

// Esta función recibe la conexión a la BD (db) y el socket (io)
function createPedidosRoutes(db, io) {

  // RUTA: Crear un nuevo pedido (POST /api/pedidos)
  router.post('/', async (req, res) => {
    try {
      const { mesa_id, restaurante_id, items, total } = req.body;

      // 1. Validaciones básicas
      if (!mesa_id || !restaurante_id || !items || items.length === 0) {
        return res.status(400).json({ error: 'Faltan datos del pedido (mesa, restaurante o items).' });
      }

      // 2. Crear el Pedido (Cabecera)
      // Usamos 'RETURNING id' para obtener el ID del pedido recién creado
      const nuevoPedido = await db.run(
        "INSERT INTO Pedidos (mesa_id, restaurante_id, total, estado) VALUES (?, ?, ?, 'recibido')",
        [mesa_id, restaurante_id, total]
      );

      const pedidoId = nuevoPedido.lastID;

      // 3. Crear los Detalles (Platos)
      for (const item of items) {
        await db.run(
          "INSERT INTO DetallePedidos (pedido_id, plato_id, cantidad) VALUES (?, ?, ?)",
          [pedidoId, item.id, item.cantidad]
        );

        // (Nota: Aquí podríamos guardar modificadores si los tuviéramos en el carrito)
      }

      // 4. Notificar a la Cocina (Tiempo Real) - SOLO a la sala del restaurante
      const pedidoCompleto = {
        id: pedidoId,
        mesa_id,
        items,
        estado: 'recibido',
        hora: new Date(),
        total
      };

      // Emitir evento a la sala específica del restaurante
      io.to(`tenant_${restaurante_id}`).emit('nuevo_pedido', pedidoCompleto);
      console.log(`Nuevo pedido recibido: Mesa ${mesa_id}, Total ${total} (Sala: tenant_${restaurante_id})`);

      // 5. Responder al cliente
      res.status(201).json({
        message: 'Pedido enviado a cocina.',
        pedidoId: pedidoId
      });

    } catch (error) {
      console.error('Error al crear pedido:', error.message);
      res.status(500).json({ error: 'Error interno al procesar el pedido.' });
    }
  });

  // RUTA: Obtener pedidos pendientes (GET /api/pedidos/pendientes?restaurante_id=1)
  router.get('/pendientes', async (req, res) => {
    try {
      const { restaurante_id } = req.query;
      if (!restaurante_id) {
        return res.status(400).json({ error: 'Falta restaurante_id' });
      }

      // Obtenemos órdenes pendientes (estado 'recibido' o 'cocinando') DE ESTE RESTAURANTE
      const ordenes = await db.all(
        "SELECT * FROM Pedidos WHERE restaurante_id = ? AND estado IN ('recibido', 'cocinando') ORDER BY id ASC",
        [restaurante_id]
      );

      const listaCompleta = [];
      for (const o of ordenes) {
        // Join con Platos para obtener el nombre
        const detalles = await db.all(`
                SELECT dp.*, p.nombre_plato 
                FROM DetallePedidos dp
                JOIN Platos p ON dp.plato_id = p.id
                WHERE dp.pedido_id = ?
            `, [o.id]);
        listaCompleta.push({ ...o, items: detalles });
      }
      res.json(listaCompleta);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // RUTA: Completar pedido (POST /api/pedidos/:id/completar)
  router.post('/:id/completar', async (req, res) => {
    try {
      const { id } = req.params;
      await db.run("UPDATE Pedidos SET estado = 'completado' WHERE id = ?", [id]);

      // Recuperar el restaurante_id para notificar a la sala correcta
      const pedido = await db.get("SELECT restaurante_id FROM Pedidos WHERE id = ?", [id]);

      if (pedido) {
        // Avisamos que se completó para quitarla de pantalla
        io.to(`tenant_${pedido.restaurante_id}`).emit('orden_completada', id);
      }

      res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}

module.exports = createPedidosRoutes;