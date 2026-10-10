import { useEffect } from 'react'
import './Feedback.css'

// Telas de feedback: o usuário sempre precisa saber o que está acontecendo.

export function TelaCarregando() {
  return (
    <main className="app app--centro" aria-busy="true" aria-live="polite">
      <div className="spinner" />
      <p className="card-subtitle">Carregando suas finanças…</p>
    </main>
  )
}

export function TelaErro({ mensagem, aoTentarNovamente }) {
  return (
    <main className="app app--centro">
      <div className="card erro-tela" role="alert">
        <p className="erro-tela__icone" aria-hidden="true">🔌</p>
        <h1>Não foi possível carregar</h1>
        <p className="card-subtitle">{mensagem}</p>
        <p className="card-subtitle">
          Confirme que a API está rodando (<code>npm run dev</code> na pasta <code>backend</code>).
        </p>
        <button id="tentar-novamente" className="btn btn--primary" onClick={aoTentarNovamente}>
          Tentar novamente
        </button>
      </div>
    </main>
  )
}

// Aviso flutuante que some sozinho depois de 6 segundos
export function Toast({ mensagem, aoFechar }) {
  useEffect(() => {
    if (!mensagem) return undefined
    const timer = setTimeout(aoFechar, 6000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagem])

  if (!mensagem) return null
  return (
    <div id="aviso" className="toast" role="alert">
      <span>⚠️ {mensagem}</span>
      <button type="button" aria-label="Fechar aviso" onClick={aoFechar}>✕</button>
    </div>
  )
}
