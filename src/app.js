require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const sessionRoutes = require('./routes/session.routes');

const app = express();

// Middleware
app.use(cors());
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
