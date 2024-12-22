const authenticateAdmin = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Accès non autorisé' });
    }

    next();
};

module.exports = authenticateAdmin;
