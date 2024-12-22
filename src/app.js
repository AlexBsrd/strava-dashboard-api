require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const sessionRoutes = require('./routes/session.routes');

const app = express();

// Middleware
const corsOptions = {
    origin: ['*'], // Ajoutez ici les origines autorisées
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 600 // Cache la réponse preflight pendant 10 minutes
};
app.options('*', cors(corsOptions)); // Active le preflight pour toutes les routes
app.use(cors(corsOptions));
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
