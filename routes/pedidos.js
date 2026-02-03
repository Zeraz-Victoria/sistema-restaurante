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

      // 2.a Calcular tiempo estimado
      // Necesitamos saber el tiempo de preparación de los platos
      let maxPrepTime = 15; // Mínimo 15 minutos por defecto

      // Obtener IDs de platos para consultar tiempos
      const platoIds = items.map(i => i.id);
      if (platoIds.length > 0) {
        // Construct placeholders manually since we can't depend on complex IN helpers here easily
        const placeholders = platoIds.map(() => '?').join(',');
        const tiempos = await db.all(
          `SELECT tiempo_preparacion FROM Platos WHERE id IN (${placeholders})`,
          platoIds
        );

        if (tiempos.length > 0) {
          const maxFromItems = Math.max(...tiempos.map(t => t.tiempo_preparacion || 15));
          if (maxFromItems > maxPrepTime) maxPrepTime = maxFromItems;
        }
      }

      // Calcular hora estimada (Ahora + maxPrepTime minutos)
      const estimatedDate = new Date();
      estimatedDate.setMinutes(estimatedDate.getMinutes() + maxPrepTime);
      const horaEstimadaStr = estimatedDate.toISOString(); // Guardamos como ISO string

      // 3. Crear Pedido con hora estimada
      const nuevoPedido = await db.run(
        "INSERT INTO Pedidos (mesa_id, restaurante_id, total, estado, hora_entrega_estimada) VALUES (?, ?, ?, 'recibido', ?)",
        [mesa_id, restaurante_id, total, horaEstimadaStr]
      );

      const pedidoId = nuevoPedido.lastID;
      const eventoSocket = 'nuevo_pedido';

      // 4. Crear Detalles
      for (const item of items) {
        await db.run(
          "INSERT INTO DetallePedidos (pedido_id, plato_id, cantidad) VALUES (?, ?, ?)",
          [pedidoId, item.id, item.cantidad]
        );
      }

      // 4. Notificar a la Cocina (Tiempo Real)
      // Recuperar datos para enviar objeto completo
      const pedidoReal = await db.get("SELECT * FROM Pedidos WHERE id = ?", [pedidoId]);

      const detalles = await db.all(`
          SELECT dp.*, p.nombre_plato 
          FROM DetallePedidos dp
          JOIN Platos p ON dp.plato_id = p.id
          WHERE dp.pedido_id = ?
      `, [pedidoId]);

      const pedidoCompleto = {
        ...pedidoReal,
        items: detalles
      };

      // Emitir evento a la sala específica del restaurante
      io.to(`tenant_${restaurante_id}`).emit(eventoSocket, pedidoCompleto);
      console.log(`Nuevo pedido recibido: Mesa ${mesa_id}, Total ${total}`);

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

      // Obtenemos órdenes pendientes Y COMPLETADAS (para que no desaparezcan al refrescar hasta que se paguen/archiven)
      const ordenes = await db.all(
        `SELECT p.*, m.numero_mesa 
         FROM Pedidos p
         LEFT JOIN Mesas m ON p.mesa_id = m.id
         WHERE p.restaurante_id = ? AND p.estado IN ('recibido', 'cocinando', 'completado') 
         ORDER BY p.id ASC`,
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

  // RUTA: Obtener cuenta de una mesa (GET /api/pedidos/cuenta)
  router.get('/cuenta', async (req, res) => {
    try {
      const { mesa_id, restaurante_id } = req.query;

      if (!mesa_id || !restaurante_id) {
        return res.status(400).json({ error: 'Falta mesa_id o restaurante_id' });
      }

      // 1. Obtener todas las órdenes de la mesa que NO estén "pagadas" (asumiendo que 'pagado' es el estado final)
      //    Por ahora, vamos a sumar todo lo que haya en 'recibido', 'cocinando', 'completado'.
      const ordenes = await db.all(
        `SELECT * FROM Pedidos 
           WHERE mesa_id = ? AND restaurante_id = ? AND estado IN ('recibido', 'cocinando', 'completado')`,
        [mesa_id, restaurante_id]
      );

      if (ordenes.length === 0) {
        return res.json({ mesa_id, total: 0, items: [] });
      }

      // 2. Calcular total y obtener items detallados para el ticket
      let granTotal = 0;
      let todosLosItems = [];
      let maxEntrega = null;

      // Podríamos hacer un JOIN gigante, pero iterar es seguro y tenemos pocos pedidos por mesa activa
      for (const pedido of ordenes) {
        granTotal += pedido.total;

        // Calcular la hora de entrega más lejana de los pedidos activos ('recibido', 'cocinando')
        if ((pedido.estado === 'recibido' || pedido.estado === 'cocinando') && pedido.hora_entrega_estimada) {
          if (!maxEntrega || new Date(pedido.hora_entrega_estimada) > new Date(maxEntrega)) {
            maxEntrega = pedido.hora_entrega_estimada;
          }
        }

        const items = await db.all(`
              SELECT dp.*, p.nombre_plato, p.precio 
              FROM DetallePedidos dp
              JOIN Platos p ON dp.plato_id = p.id
              WHERE dp.pedido_id = ?
          `, [pedido.id]);

        todosLosItems.push(...items);
      }

      res.json({
        mesa_id,
        total: granTotal,
        items: todosLosItems,
        fecha: new Date(),
        hora_entrega_estimada: maxEntrega // Start timer based on this
      });

    } catch (e) {
      console.error('Error al obtener cuenta:', e);
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

module.exports = createPedidosRoutes;