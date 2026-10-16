// =====================================================
// BANCO DE DADOS (PostgreSQL)
// Agora conectado ao Supabase
// =====================================================
import pg from 'pg'
const { Pool } = pg
import { config } from './config.js'

// Cria a conexão usando a string de conexão (ex: postgresql://...)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// Função para converter `?` do SQLite para `$1`, `$2` do Postgres
function translateSql(sql) {
  let i = 1
  return sql.replace(/\?/g, () => `$${i++}`)
}

export const db = {
  prepare: (sql) => {
    const translated = translateSql(sql)
    return {
      get: async (...params) => {
        const res = await pool.query(translated, params)
        return res.rows[0]
      },
      all: async (...params) => {
        const res = await pool.query(translated, params)
        return res.rows
      },
      run: async (...params) => {
        let runSql = translated
        if (runSql.trim().toUpperCase().startsWith('INSERT')) {
          runSql += ' RETURNING id'
        }
        const res = await pool.query(runSql, params)
        return { lastInsertRowid: res.rows[0]?.id }
      }
    }
  },
  exec: async (sql) => {
    await pool.query(sql)
  }
}

// -----------------------------------------------------
// ESQUEMA
// -----------------------------------------------------
export async function criarTabelas() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS bancos (
      id             SERIAL PRIMARY KEY,
      nome           TEXT    NOT NULL UNIQUE,
      tipo           TEXT    NOT NULL CHECK (tipo IN ('Débito', 'Crédito', 'Múltiplo', 'Benefício')),
      limite_total   REAL    NOT NULL DEFAULT 0 CHECK (limite_total >= 0),
      dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
      dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
      cor            TEXT    NOT NULL DEFAULT '#8b5cf6'
    );

    CREATE TABLE IF NOT EXISTS transacoes (
      id             SERIAL PRIMARY KEY,
      descricao      TEXT    NOT NULL,
      valor          REAL    NOT NULL CHECK (valor > 0),
      tipo           TEXT    NOT NULL CHECK (tipo IN ('Receita', 'Despesa')),
      banco_id       INTEGER NOT NULL REFERENCES bancos(id) ON DELETE RESTRICT,
      categoria      TEXT    NOT NULL CHECK (categoria IN ('Fixo', 'Variável')),
      data_compra    TEXT    NOT NULL,
      forma_pagamento TEXT   NOT NULL DEFAULT 'Crédito' CHECK (forma_pagamento IN ('Crédito', 'Débito', 'PIX', 'Dinheiro', 'Voucher')),
      parcela_atual  INTEGER NOT NULL DEFAULT 1 CHECK (parcela_atual >= 1),
      total_parcelas INTEGER NOT NULL DEFAULT 1 CHECK (total_parcelas >= 1),
      ativa          INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
      CHECK (parcela_atual <= total_parcelas)
    );

    CREATE TABLE IF NOT EXISTS cofre (
      id          SERIAL PRIMARY KEY,
      objetivo    TEXT NOT NULL UNIQUE,
      saldo_atual REAL NOT NULL DEFAULT 0 CHECK (saldo_atual >= 0)
    );

    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pagamentos_fixas (
      id             SERIAL PRIMARY KEY,
      transacao_id   INTEGER NOT NULL REFERENCES transacoes(id) ON DELETE CASCADE,
      mes            TEXT    NOT NULL,
      pago_em        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(transacao_id, mes)
    );

    CREATE TABLE IF NOT EXISTS pagamentos_faturas (
      id             SERIAL PRIMARY KEY,
      banco_id       INTEGER NOT NULL REFERENCES bancos(id) ON DELETE CASCADE,
      mes            TEXT    NOT NULL,
      pago_em        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(banco_id, mes)
    );

    CREATE INDEX IF NOT EXISTS idx_transacoes_banco ON transacoes(banco_id);
    CREATE INDEX IF NOT EXISTS idx_transacoes_data  ON transacoes(data_compra);
    CREATE INDEX IF NOT EXISTS idx_pagamentos_fixas_mes ON pagamentos_fixas(mes);
    CREATE INDEX IF NOT EXISTS idx_pagamentos_faturas_mes ON pagamentos_faturas(mes);
  `)
}

export async function lerConfig(chave) {
  const row = await db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(chave)
  return row?.valor ?? null
}

export async function salvarConfig(chave, valor) {
  await db.prepare(
    'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
  ).run(chave, String(valor))
}
