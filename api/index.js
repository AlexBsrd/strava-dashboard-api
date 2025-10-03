require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('../src/config/database');
const sessionRoutes = require('../src/routes/session.routes');

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

// Base de données
connectDB();

// Export pour Vercel
module.exports = app;
