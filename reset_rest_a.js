const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.resolve(__dirname, 'restaurante.sqlite');
const db = new sqlite3.Database(dbPath);

async function resetPass() {
    console.log('Resetting password for admin@rest-a.com...');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('123456', salt);

    db.run("UPDATE Usuarios SET password_hash = ? WHERE email = ?", [hash, 'admin@rest-a.com'], function (err) {
        if (err) {
            console.error('Error updating password:', err);
        } else {
            console.log(`Success! Updated ${this.changes} rows. Password for admin@rest-a.com set to 123456`);
        }
        db.close();
    });
}

resetPass();
