const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const dbPath = path.resolve(__dirname, 'restaurante.sqlite');

const db = new sqlite3.Database(dbPath);

(async () => {
    const email = 'admin@example.com';
    const password = '123456';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // ID de restaurante 1 (creado por defecto)
    const restaurante_id = 1;

    db.run("INSERT OR IGNORE INTO Usuarios (email, password_hash, rol, restaurante_id) VALUES (?, ?, ?, ?)", [email, hash, 'dueño', restaurante_id], function (err) {
        if (err) {
            console.error("Error creando admin:", err.message);
        } else {
            console.log(`Admin creado/verificado: ${email} con pass ${password}`);
        }
        db.close();
    });
})();
