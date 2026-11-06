const express = require('express');
const router = express.Router();
const Session = require('../models/session.model');
const { authenticate, authenticateAdmin } = require('../middleware/auth.middleware');

// Authentification requise pour toutes les routes
router.use(authenticate);

// Les sessions sont créées par POST /api/auth/token (échange du code OAuth côté serveur)

// Vérifier une session
router.get('/:athleteId/check', async (req, res) => {
    try {
        const session = await Session.findOne({ athleteId: req.params.athleteId });
        if (!session) {
            return res.status(404).send('Session not found');
        }

        // Mettre à jour lastActivity
        session.lastActivity = new Date();
        await session.save();

        res.status(200).send();
    } catch (error) {
        console.error('Error checking session:', error);
        res.status(500).send(error.message);
    }
});

// Mettre à jour l'activité
router.post('/:athleteId/activity', async (req, res) => {
    try {
        const session = await Session.findOneAndUpdate(
            { athleteId: req.params.athleteId },
            { lastActivity: new Date() }
        );

        if (!session) {
            return res.status(404).send('Session not found');
        }

        res.status(200).send();
    } catch (error) {
        console.error('Error updating activity:', error);
        res.status(500).send(error.message);
    }
});

// Lister toutes les sessions (admin seulement)
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        const sessions = await Session.find()
            .sort({ lastActivity: -1 });

        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).send(error.message);
    }
});

// Supprimer une session (admin seulement : la clé client est publique, elle ne prouve pas l'identité)
router.delete('/:athleteId', authenticateAdmin, async (req, res) => {
    try {
        const session = await Session.findOne({ athleteId: req.params.athleteId });
        if (!session) {
            return res.status(404).send('Session not found');
        }

        await session.deleteOne();
        res.status(200).send();
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).send(error.message);
    }
});

module.exports = router;
