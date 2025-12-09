const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.resolve(__dirname, 'restaurante.sqlite');
const db = new sqlite3.Database(dbPath);

(async () => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('123456', salt);

        db.serialize(() => {
            // 1. Super Admin
            // Delete if exists to ensure we know the password
            db.run("DELETE FROM Usuarios WHERE email = 'super@admin.com'");

            db.run("INSERT INTO Usuarios (email, password_hash, rol) VALUES ('super@admin.com', ?, 'superadmin')", [hash], function (err) {
                if (err) console.error("Error creating superadmin:", err.message);
                else console.log("✅ Super Admin created: super@admin.com / 123456");
            });

            // 2. Admin for Rest A
            db.get("SELECT id FROM Restaurantes WHERE slug = 'rest-a'", [], (err, row) => {
                if (err) {
                    console.error("Error finding rest-a:", err);
                    return;
                }
                if (!row) {
                    console.error("Restaurante 'rest-a' not found. Please verify it exists.");
                    return;
                }

                db.run("DELETE FROM Usuarios WHERE email = 'admin@rest-a.com'");

                db.run("INSERT INTO Usuarios (email, password_hash, rol, restaurante_id) VALUES ('admin@rest-a.com', ?, 'dueño', ?)", [hash, row.id], function (err) {
                    if (err) console.error("Error creating tenant admin:", err.message);
                    else console.log("✅ Tenant Admin created: admin@rest-a.com / 123456");
                });
            });
        });

    } catch (error) {
        console.error("Error in script:", error);
    }
})();
