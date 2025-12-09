const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'restaurante.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("--- Restaurantes ---");
    db.all("SELECT * FROM Restaurantes", (err, rows) => {
        console.log(rows);
    });

    console.log("\n--- Usuarios ---");
    db.all("SELECT id, email, rol, restaurante_id, password_hash FROM Usuarios", (err, rows) => {
        console.log(rows);
    });
});

db.close();
