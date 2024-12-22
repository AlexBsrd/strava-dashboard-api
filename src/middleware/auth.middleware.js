const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
// Assurez-vous que la clé fait exactement 32 caractères
const secretKey = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

// Fonction pour générer un nouveau IV pour chaque chiffrement
const generateIv = () => crypto.randomBytes(16);

// Fonctions de chiffrement/déchiffrement
const encrypt = (text) => {
    const iv = generateIv();
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted.toString('hex')
    };
};

const decrypt = (encryptedData, iv) => {
    const decipher = crypto.createDecipheriv(
        algorithm,
        secretKey,
        Buffer.from(iv, 'hex')
    );
    let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};

// Middleware d'authentification générique
const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({ error: 'API key manquante' });
    }

    // Vérifier l'API key en fonction du type d'utilisateur
    if (apiKey === process.env.ADMIN_API_KEY) {
        req.userRole = 'admin';
    } else if (apiKey === process.env.CLIENT_API_KEY) {
        req.userRole = 'client';
    } else {
        return res.status(401).json({ error: 'API key invalide' });
    }

    next();
};

// Middleware spécifique pour l'admin
const authenticateAdmin = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Accès non autorisé' });
    }

    req.userRole = 'admin';
    next();
};

module.exports = {
    authenticate,
    authenticateAdmin,
    encrypt,
    decrypt
};
