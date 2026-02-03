
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'public/uploads/';
        // Asegurar que el directorio existe
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Nombre único: timestamp + extensión original
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'imagen-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp).'));
    }
});

/*
 * POST /api/upload
 * Sube una imagen y devuelve su URL.
 */
router.post('/', upload.single('imagen'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo.' });
        }

        // Construir URL pública
        // Asume que 'public' es servido estáticamente en la raíz '/'
        const publicUrl = `/uploads/${req.file.filename}`;

        res.json({
            message: 'Imagen subida con éxito.',
            url: publicUrl
        });
    } catch (error) {
        console.error('Error en upload:', error);
        res.status(500).json({ error: 'Error al subir la imagen.' });
    }
});

module.exports = router;
