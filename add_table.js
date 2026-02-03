const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'restaurante.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Check if table exists, if not create one
    db.run("INSERT INTO Mesas (numero_mesa, restaurante_id) VALUES ('Mesa 1', 1)", (err) => {
        if (err) {
            console.log("Insert failed (maybe exists): " + err.message);
        } else {
            console.log("Mesa 1 inserted.");
        }
    });

    db.all("SELECT * FROM Mesas", (err, rows) => {
        console.log("\nAll Mesas:");
        console.log(rows);
    });
});

db.close();
