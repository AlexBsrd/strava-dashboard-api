const express = require('express');
const router = express.Router();
const Session = require('../models/session.model');
const authenticateAdmin = require("../middleware/auth.middleware");

router.use((req, res, next) => {
    const origin = req.headers.origin || req.headers.referer || 'Unknown Origin';
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Origin: ${origin}`);
    next(); // Passe à la route suivante
});

// Créer ou mettre à jour une session
router.post('/', async (req, res) => {
    try {
        const { athleteId, firstname, lastname, accessToken, refreshToken, expiresAt } = req.body;

        await Session.findOneAndUpdate(
            { athleteId },
            {
                athleteId,
                firstname,
                lastname,
                accessToken,
                refreshToken,
                expiresAt,
                lastActivity: new Date()
            },
            { upsert: true, new: true }
        );

        res.status(201).send();
    } catch (error) {
        console.error('Error creating/updating session:', error);
        res.status(500).send(error.message);
    }
});

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

// Lister toutes les sessions (pour l'admin)
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        const sessions = await Session.find()
            .select('-accessToken -refreshToken')
            .sort({ lastActivity: -1 });

        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).send(error.message);
    }
});

// Supprimer une session
router.delete('/:athleteId', async (req, res) => {
    try {
        // Récupérer d'abord la session
        const session = await Session.findOne({ athleteId: req.params.athleteId });
        if (!session) {
            return res.status(404).send('Session not found');
        }

        // Appeler la méthode remove() qui déclenchera le middleware
        await session.deleteOne();

        res.status(200).send();
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).send(error.message);
    }
});

module.exports = router;
