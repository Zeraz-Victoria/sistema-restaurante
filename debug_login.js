const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const dbPath = path.resolve(__dirname, 'restaurante.sqlite');

const db = new sqlite3.Database(dbPath);

const email = 'admin@example.com';
const password = '123456';

db.get("SELECT * FROM Usuarios WHERE email = ?", [email], async (err, row) => {
    if (err) {
        console.error("Error DB:", err);
    } else if (!row) {
        console.error("Usuario NO encontrado en DB.");

        // Auto-fix: Create if missing
        console.log("Creando usuario de nuevo...");
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        db.run("INSERT INTO Usuarios (email, password_hash, rol, restaurante_id) VALUES (?, ?, ?, ?)", [email, hash, 'dueño', 1], (err) => {
            if (err) console.error("Error creando:", err);
            else console.log("Usuario creado. Intenta login de nuevo.");
        });

    } else {
        console.log("Usuario encontrado:", row.email);
        console.log("Hash almacenado:", row.password_hash);

        const match = await bcrypt.compare(password, row.password_hash);
        console.log("¿La contraseña coincide?", match);
    }
});
