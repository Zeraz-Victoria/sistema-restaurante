/*
 * ==========================================================
 * ARCHIVO: database.js
 * PROPÓSITO: Abstracción de base de datos (Soporta SQLite y PostgreSQL).
 * ==========================================================
 */

require('dotenv').config();
const path = require('path');

// Detectar si estamos usando PostgreSQL (por ejemplo, en Render)
const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');

console.log(`🔌 Modo Base de Datos: ${isPostgres ? 'POSTGRESQL (Nube)' : 'SQLITE (Local)'}`);

let pool;
let sqliteDb;

if (isPostgres) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Necesario para Render/Heroku
  });
} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(__dirname, 'restaurante.sqlite');
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error al conectar con SQLite:', err.message);
    else console.log('✅ SQLite conectado en:', dbPath);
  });
}

// Helper: Convertir '?' de SQLite a '$1, $2, ...' de Postgres
function normalizeSql(sql) {
  if (!isPostgres) return sql;
  let i = 1;
  // Reemplaza cada ? por $1, $2, $3...
  return sql.replace(/\?/g, () => `$${i++}`);
}

const db = {
  // SELECT (Muchas filas)
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (isPostgres) {
        pool.query(normalizeSql(sql), params, (err, res) => {
          if (err) return reject(err);
          resolve(res.rows);
        });
      } else {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      }
    });
  },

  // SELECT (Una fila)
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (isPostgres) {
        pool.query(normalizeSql(sql), params, (err, res) => {
          if (err) return reject(err);
          resolve(res.rows[0]);
        });
      } else {
        sqliteDb.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      }
    });
  },

  // INSERT / UPDATE / DELETE
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (isPostgres) {
        // Postgres necesita 'RETURNING id' para devolver el ID insertado
        let finalSql = normalizeSql(sql);

        // Si es un INSERT y no tiene RETURNING, lo agregamos para simular this.lastID
        const isInsert = /^\s*INSERT/i.test(finalSql);
        if (isInsert && !/RETURNING/i.test(finalSql)) {
          finalSql += ' RETURNING id';
        }
        // Si es UPDATE/DELETE y queremos changes, PG devuelve rowCount en el result

        pool.query(finalSql, params, (err, res) => {
          if (err) return reject(err);
          // Simulamos el objeto de retorno de SQLite
          resolve({
            lastID: res.rows[0]?.id || 0,
            changes: res.rowCount
          });
        });
      } else {
        // SQLite: Quitamos RETURNING si existe (legacy PG code)
        const cleanSql = sql.replace(/RETURNING id/i, '');
        sqliteDb.run(cleanSql, params, function (err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      }
    });
  },

  // DDL (Create Table, etc)
  exec: (sql) => {
    return new Promise((resolve, reject) => {
      if (isPostgres) {
        pool.query(sql, (err) => {
          if (err) return reject(err);
          resolve();
        });
      } else {
        sqliteDb.exec(sql, (err) => {
          if (err) return reject(err);
          resolve();
        });
      }
    });
  }
};


async function setupDatabase() {
  console.log(`🔨 Configurando tablas (` + (isPostgres ? 'Postgres' : 'SQLite') + ')...');

  // Dialectos
  const AUTO_INC = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const TEXT_TYPE = 'TEXT';
  const JSON_TYPE = isPostgres ? 'JSONB' : 'TEXT'; // Ejemplo si usáramos JSON

  // 1. Restaurantes
  // Nota: "plan_activo_hasta" usa texto YYYY-MM-DD en ambos por simplicidad
  await db.exec(`
      CREATE TABLE IF NOT EXISTS Restaurantes (
          id ${AUTO_INC},
          nombre_restaurante ${TEXT_TYPE} NOT NULL UNIQUE,
          slug ${TEXT_TYPE} UNIQUE,
          plan_activo_hasta ${TEXT_TYPE} DEFAULT '1970-01-01'
      );
    `);

  // Migraciones y Seeds (Compatibilidad Dual)
  try {
    if (!isPostgres) {
      // SQLite specific migrations
      try { await db.run("ALTER TABLE Restaurantes ADD COLUMN slug TEXT"); } catch (e) { }
    } else {
      // Postgres specific migrations
      try { await db.run("ALTER TABLE Restaurantes ADD COLUMN IF NOT EXISTS slug TEXT"); } catch (e) { }
      // Fix: If table existed but was empty/wrong schema, ensure critical columns exist
      try { await db.run("ALTER TABLE Restaurantes ADD COLUMN IF NOT EXISTS nombre_restaurante TEXT DEFAULT 'Sin Nombre'"); } catch (e) { }
      try { await db.run("ALTER TABLE Restaurantes ADD COLUMN IF NOT EXISTS plan_activo_hasta TEXT DEFAULT '2099-12-31'"); } catch (e) { }

      // Fix: Drop conflicting legacy column 'nombre' if it exists causing Not Null errors
      try { await db.run("ALTER TABLE Restaurantes DROP COLUMN IF EXISTS nombre"); } catch (e) { }

      // Fix: Rename legacy 'nombre' column in Categorias to 'nombre_categoria' if it exists
      try { await db.run("ALTER TABLE Categorias RENAME COLUMN nombre TO nombre_categoria"); } catch (e) { }
    }
  } catch (e) { }

  // Seed Restaurante Demo
  try {
    if (isPostgres) {
      await db.run("INSERT INTO Restaurantes (nombre_restaurante, slug, plan_activo_hasta) VALUES ($1, $2, $3) ON CONFLICT (nombre_restaurante) DO NOTHING", ['Restaurante Demo', 'restaurante-demo', '2099-12-31']);
    } else {
      await db.run("INSERT OR IGNORE INTO Restaurantes (nombre_restaurante, slug, plan_activo_hasta) VALUES (?, ?, ?)", ['Restaurante Demo', 'restaurante-demo', '2099-12-31']);
    }
  } catch (e) { }

  // 2. Usuarios
  await db.exec(`
      CREATE TABLE IF NOT EXISTS Usuarios (
          id ${AUTO_INC},
          email ${TEXT_TYPE} NOT NULL UNIQUE,
          password_hash ${TEXT_TYPE} NOT NULL,
          rol ${TEXT_TYPE} NOT NULL, 
          restaurante_id INTEGER REFERENCES Restaurantes(id)
      );
    `);

  // 3. Mesas
  // UNIQUE constraint naming is automatic usually
  await db.exec(`
      CREATE TABLE IF NOT EXISTS Mesas (
          id ${AUTO_INC},
          numero_mesa ${TEXT_TYPE} NOT NULL,
          restaurante_id INTEGER NOT NULL REFERENCES Restaurantes(id),
          UNIQUE (numero_mesa, restaurante_id)
      );
    `);

  // 4. Categorías
  await db.exec(`
      CREATE TABLE IF NOT EXISTS Categorias (
          id ${AUTO_INC},
          nombre_categoria ${TEXT_TYPE} NOT NULL,
          restaurante_id INTEGER NOT NULL REFERENCES Restaurantes(id),
          UNIQUE (nombre_categoria, restaurante_id)
      );
    `);

  // 5. Platos
  await db.exec(`
      CREATE TABLE IF NOT EXISTS Platos (
          id ${AUTO_INC},
          nombre_plato ${TEXT_TYPE} NOT NULL,
          descripcion ${TEXT_TYPE},
          precio REAL NOT NULL,
          categoria_id INTEGER NOT NULL REFERENCES Categorias(id),
          imagen_url ${TEXT_TYPE}
      );
    `);

  // 6. Modificadores
  await db.exec(`
      CREATE TABLE IF NOT EXISTS Modificadores (
          id ${AUTO_INC},
          nombre_modificador ${TEXT_TYPE} NOT NULL,
          precio_extra REAL DEFAULT 0.00,
          plato_id INTEGER NOT NULL REFERENCES Platos(id)
      );
    `);

  // 7. Pedidos
  await db.exec(`
      CREATE TABLE IF NOT EXISTS Pedidos (
          id ${AUTO_INC},
          estado ${TEXT_TYPE} NOT NULL DEFAULT 'recibido',
          hora_pedido ${TEXT_TYPE} DEFAULT CURRENT_TIMESTAMP,
          mesa_id INTEGER NOT NULL REFERENCES Mesas(id),
          restaurante_id INTEGER NOT NULL REFERENCES Restaurantes(id),
          total REAL DEFAULT 0
      );
    `);

  // 8. DetallePedidos
  await db.exec(`
      CREATE TABLE IF NOT EXISTS DetallePedidos (
          id ${AUTO_INC},
          pedido_id INTEGER NOT NULL REFERENCES Pedidos(id),
          plato_id INTEGER NOT NULL REFERENCES Platos(id),
          cantidad INTEGER DEFAULT 1
      );
    `);

  // 9. DetalleModificadores
  await db.exec(`
      CREATE TABLE IF NOT EXISTS DetalleModificadores (
          id ${AUTO_INC},
          detalle_pedido_id INTEGER NOT NULL REFERENCES DetallePedidos(id),
          modificador_id INTEGER NOT NULL REFERENCES Modificadores(id),
          nota ${TEXT_TYPE}
      );
    `);

  console.log('✅ Tablas configuradas correctamente.');
  return db;
}

module.exports = { setupDatabase, db };