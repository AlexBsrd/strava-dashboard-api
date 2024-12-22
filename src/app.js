require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const sessionRoutes = require('./routes/session.routes');

const app = express();

const corsOptions = {
    origin: ['http://localhost:4200', 'https://alexbsrd.github.io/strava-dashboard'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
    maxAge: 600, // Durée du cache des requêtes preflight
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

// Routes
app.use('/api/sessions', sessionRoutes);

// Base de données
connectDB();

// Port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
