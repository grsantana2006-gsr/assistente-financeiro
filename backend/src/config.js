// =====================================================
// CONFIGURAÇÃO
// Lê o arquivo backend/.env (se existir) e centraliza as variáveis de ambiente.
// O .env guarda SEGREDOS (como o token do bot) e NÃO vai para o git.
// Este arquivo precisa ser o PRIMEIRO import do server.js.
// =====================================================
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mesLocalAtual } from './datas.js'

const pastaDoProjeto = resolve(dirname(fileURLToPath(import.meta.url)), '..')

try {
  process.loadEnvFile(resolve(pastaDoProjeto, '.env')) // recurso nativo do Node 22
} catch {
  // Sem .env? Tudo bem: usamos os valores padrão abaixo.
}

export const config = {
  porta: process.env.PORT ?? 3000,

  // Token do bot (segredo!). Sem ele, o bot simplesmente fica desligado.
  telegramToken: process.env.TELEGRAM_TOKEN?.trim() || null,
  // Opcional: fixa o chat autorizado em vez de parear com o primeiro /start
  telegramChatId: process.env.TELEGRAM_CHAT_ID?.trim() || null,
  // Só muda em testes (aponta para um "Telegram falso")
  telegramApiUrl: process.env.TELEGRAM_API_URL ?? 'https://api.telegram.org',

  // Opcional: força um mês de referência (ex.: 2026-10). Padrão: mês atual.
  mesReferencia: process.env.MES_REFERENCIA?.trim() || null,
}

export const obterMesReferencia = () => config.mesReferencia ?? mesLocalAtual()
