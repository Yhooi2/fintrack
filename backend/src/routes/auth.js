'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function issueToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '24h' });
}

// Регистрация нового пользователя.
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Некорректный e-mail').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Пароль не короче 8 символов'),
    body('fullName').trim().notEmpty().withMessage('Укажите ФИО'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { email, password, fullName } = req.body;
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (exists) {
      return res.status(409).json({ error: 'Пользователь с таким e-mail уже существует' });
    }

    // Пароль никогда не хранится в открытом виде — только bcrypt-хэш.
    const passwordHash = bcrypt.hashSync(password, 12);
    const info = db
      .prepare('INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)')
      .run(email, passwordHash, fullName);

    return res.status(201).json({ token: issueToken(info.lastInsertRowid) });
  }
);

// Вход по e-mail и паролю.
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    // Единое сообщение об ошибке, чтобы не раскрывать, существует ли учётная запись.
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Неверный e-mail или пароль' });
    }

    return res.json({ token: issueToken(user.id) });
  }
);

module.exports = router;
