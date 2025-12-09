/*
 * ==========================================================
 * ARCHIVO: seed.js
 * PROPÓSITO: Poblar la base de datos con datos de prueba.
 * EJECUTAR CON: node seed.js
 * ==========================================================
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  console.log('🌱 Iniciando siembra de datos...');

  try {
    // 1. LIMPIEZA (Opcional: Borra todo para empezar desde el ID 1)
    // "RESTART IDENTITY" reinicia los contadores de ID a 1.
    console.log('🧹 Limpiando tablas antiguas...');
    await pool.query(`
      TRUNCATE TABLE 
        DetalleModificadores, 
        DetallePedidos, 
        Pedidos, 
        Modificadores, 
        Platos, 
        Categorias, 
        Mesas, 
        Usuarios, 
        Restaurantes 
      RESTART IDENTITY CASCADE;
    `);

    // 2. CREAR RESTAURANTE
    console.log('🏢 Creando Restaurante...');
    const resRest = await pool.query(
      "INSERT INTO Restaurantes (nombre_restaurante) VALUES ($1) RETURNING id",
      ['La Taquería de Prueba']
    );
    const restauranteId = resRest.rows[0].id; // Debería ser 1

    // 3. CREAR USUARIO (DUEÑO)
    console.log('👤 Creando Dueño...');
    const passwordHash = await bcrypt.hash('123456', 10);
    await pool.query(
      "INSERT INTO Usuarios (email, password_hash, rol, restaurante_id) VALUES ($1, $2, $3, $4)",
      ['admin@taqueria.com', passwordHash, 'dueño', restauranteId]
    );

    // 4. CREAR MESAS
    console.log('🪑 Creando Mesas...');
    await pool.query("INSERT INTO Mesas (numero_mesa, restaurante_id) VALUES ($1, $2)", ['1', restauranteId]);
    await pool.query("INSERT INTO Mesas (numero_mesa, restaurante_id) VALUES ($1, $2)", ['2', restauranteId]);
    await pool.query("INSERT INTO Mesas (numero_mesa, restaurante_id) VALUES ($1, $2)", ['3', restauranteId]);

    // 5. CREAR CATEGORÍAS
    console.log('📂 Creando Categorías...');
    const catTacos = await pool.query("INSERT INTO Categorias (nombre_categoria, restaurante_id) VALUES ($1, $2) RETURNING id", ['Tacos', restauranteId]);
    const catBebidas = await pool.query("INSERT INTO Categorias (nombre_categoria, restaurante_id) VALUES ($1, $2) RETURNING id", ['Bebidas', restauranteId]);
    const catPostres = await pool.query("INSERT INTO Categorias (nombre_categoria, restaurante_id) VALUES ($1, $2) RETURNING id", ['Postres', restauranteId]);

    // 6. CREAR PLATOS
    console.log('🌮 Creando Platos...');
    
    // Tacos al Pastor
    const platoPastor = await pool.query(
      "INSERT INTO Platos (nombre_plato, descripcion, precio, categoria_id, restaurante_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      ['Tacos al Pastor', 'Orden de 5 con piña y cilantro.', 85.00, catTacos.rows[0].id, restauranteId]
    );

    // Tacos de Bistec
    const platoBistec = await pool.query(
      "INSERT INTO Platos (nombre_plato, descripcion, precio, categoria_id, restaurante_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      ['Tacos de Bistec', 'Orden de 5 con cebollitas asadas.', 95.00, catTacos.rows[0].id, restauranteId]
    );

    // Refresco
    const platoRefresco = await pool.query(
      "INSERT INTO Platos (nombre_plato, descripcion, precio, categoria_id, restaurante_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      ['Refresco Cola', 'Lata de 355ml bien fría.', 25.00, catBebidas.rows[0].id, restauranteId]
    );

    // Flan
    await pool.query(
      "INSERT INTO Platos (nombre_plato, descripcion, precio, categoria_id, restaurante_id) VALUES ($1, $2, $3, $4, $5)",
      ['Flan Napolitano', 'Receta de la abuela.', 45.00, catPostres.rows[0].id, restauranteId]
    );

    // 7. CREAR MODIFICADORES
    console.log('✨ Añadiendo Modificadores...');
    
    // Modificadores para Tacos
    await pool.query("INSERT INTO Modificadores (nombre_modificador, precio_extra, plato_id, restaurante_id) VALUES ($1, $2, $3, $4)", ['Con todo', 0.00, platoPastor.rows[0].id, restauranteId]);
    await pool.query("INSERT INTO Modificadores (nombre_modificador, precio_extra, plato_id, restaurante_id) VALUES ($1, $2, $3, $4)", ['Sin piña', 0.00, platoPastor.rows[0].id, restauranteId]);
    await pool.query("INSERT INTO Modificadores (nombre_modificador, precio_extra, plato_id, restaurante_id) VALUES ($1, $2, $3, $4)", ['Extra Queso', 20.00, platoPastor.rows[0].id, restauranteId]);
    
    await pool.query("INSERT INTO Modificadores (nombre_modificador, precio_extra, plato_id, restaurante_id) VALUES ($1, $2, $3, $4)", ['Con todo', 0.00, platoBistec.rows[0].id, restauranteId]);
    await pool.query("INSERT INTO Modificadores (nombre_modificador, precio_extra, plato_id, restaurante_id) VALUES ($1, $2, $3, $4)", ['Sin cebolla', 0.00, platoBistec.rows[0].id, restauranteId]);

    // Modificadores para Bebida
    await pool.query("INSERT INTO Modificadores (nombre_modificador, precio_extra, plato_id, restaurante_id) VALUES ($1, $2, $3, $4)", ['Con Hielo', 0.00, platoRefresco.rows[0].id, restauranteId]);
    await pool.query("INSERT INTO Modificadores (nombre_modificador, precio_extra, plato_id, restaurante_id) VALUES ($1, $2, $3, $4)", ['Sin Hielo', 0.00, platoRefresco.rows[0].id, restauranteId]);

    console.log('✅ ¡Base de datos poblada con éxito!');
    console.log(`👉 Restaurante ID: ${restauranteId}`);
    console.log(`👉 Usuario: admin@taqueria.com / 123456`);

  } catch (error) {
    console.error('❌ Error al poblar la base de datos:', error);
  } finally {
    pool.end(); // Cierra la conexión
  }
}

seed();