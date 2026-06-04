'use strict';

const express = require('express');
const { body, query, validationResult } = require('express-validator');

const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();
router.use(auth); // все операции доступны только авторизованным пользователям

// Список операций пользователя с необязательной фильтрацией по периоду.
router.get(
  '/',
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  (req, res) => {
    const { from, to } = req.query;
    let sql = 'SELECT * FROM transactions WHERE user_id = ?';
    const params = [req.userId];

    if (from) { sql += ' AND spent_at >= ?'; params.push(from); }
    if (to)   { sql += ' AND spent_at <= ?'; params.push(to); }
    sql += ' ORDER BY spent_at DESC, id DESC';

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  }
);

// Создание новой операции (дохода или расхода).
router.post(
  '/',
  [
    body('kind').isIn(['income', 'expense']),
    body('amount').isFloat({ gt: 0 }).withMessage('Сумма должна быть положительной'),
    body('categoryId').optional({ nullable: true }).isInt(),
    body('note').optional().trim(),
    body('spentAt').optional().isISO8601(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { kind, amount, categoryId = null, note = null, spentAt } = req.body;
    // Деньги хранятся в копейках (целое число), чтобы избежать ошибок округления float.
    const amountKopecks = Math.round(Number(amount) * 100);

    const info = db
      .prepare(
        `INSERT INTO transactions (user_id, category_id, kind, amount, note, spent_at)
         VALUES (?, ?, ?, ?, ?, COALESCE(?, date('now')))`
      )
      .run(req.userId, categoryId, kind, amountKopecks, note, spentAt || null);

    const created = db
      .prepare('SELECT * FROM transactions WHERE id = ?')
      .get(info.lastInsertRowid);
    res.status(201).json(created);
  }
);

// Удаление операции (только своей).
router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);

  if (info.changes === 0) {
    return res.status(404).json({ error: 'Операция не найдена' });
  }
  res.status(204).end();
});

// Сводная аналитика: баланс, суммы доходов и расходов за период.
router.get('/summary', (req, res) => {
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN kind = 'income'  THEN amount END), 0) AS income,
         COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount END), 0) AS expense
       FROM transactions WHERE user_id = ?`
    )
    .get(req.userId);

  res.json({
    incomeRub: row.income / 100,
    expenseRub: row.expense / 100,
    balanceRub: (row.income - row.expense) / 100,
  });
});

module.exports = router;
