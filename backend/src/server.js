'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Раздача статического фронтенда.
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// REST API.
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);

// Проверка работоспособности сервиса.
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Единый обработчик непредвиденных ошибок.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`FinTrack API запущен на http://localhost:${PORT}`);
});
