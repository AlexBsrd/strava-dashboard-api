require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('../src/config/database');
const sessionRoutes = require('../src/routes/session.routes');
const { checkInactiveSessions } = require('../src/models/session.model');

const app = express();

const corsOptions = {
    origin: ['http://localhost:4200', 'https://alexbsrd.github.io'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
    maxAge: 600,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

// Routes
app.use('/api/sessions', sessionRoutes);

// Vercel Cron (voir vercel.json) : Vercel envoie "Authorization: Bearer $CRON_SECRET"
app.get('/api/cron/check-sessions', async (req, res) => {
    if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).send();
    }
    await checkInactiveSessions();
    res.status(200).send();
});

// Base de données
connectDB();

// Export pour Vercel
module.exports = app;
