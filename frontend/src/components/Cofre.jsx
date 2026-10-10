import { useState } from 'react'
import { formatarMoeda } from '../utils/format'
import './DespesasFixas.css'

function Cofre({ cofre, aoAdicionar, aoAtualizar, aoRemover }) {
  const [objetivo, setObjetivo] = useState('')
  const [saldo, setSaldo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const itens = cofre?.itens ?? []
  const total = cofre?.total ?? 0

  async function enviar(evento) {
    evento.preventDefault()
    const valorNumerico = Number(saldo.replace(',', '.'))
    if (!objetivo.trim() || Number.isNaN(valorNumerico) || valorNumerico < 0) return

    setEnviando(true)
    const deuCerto = await aoAdicionar({
      objetivo: objetivo.trim(),
      saldo_atual: valorNumerico
    })
    setEnviando(false)

    if (deuCerto) {
      setObjetivo('')
      setSaldo('')
    }
  }

  return (
    <section aria-labelledby="titulo-cofre">
      <div className="secao__cabecalho">
        <h2 id="titulo-cofre">Cofre & Objetivos</h2>
        <p className="card-subtitle">Dinheiro guardado para investimentos, reservas ou metas.</p>
      </div>

      <div className="card fixas">
        <div className="fixas__total" style={{ borderBottomColor: 'var(--primary)' }}>
          <p className="card-subtitle">Saldo Total</p>
          <p className="fixas__total-valor" style={{ color: 'var(--primary)' }}>{formatarMoeda(total)}</p>
        </div>

        {itens.length === 0 ? (
          <p className="fixas__vazio">Nenhum objetivo cadastrado.</p>
        ) : (
          <ul className="fixas__lista">
            {itens.map((c) => (
              <li key={c.id} className="fixas__item" style={{ borderLeft: '4px solid var(--primary)' }}>
                <div className="fixas__info">
                  <span className="fixas__nome">{c.objetivo}</span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  defaultValue={c.saldo_atual}
                  onBlur={(e) => {
                    const novoSaldo = Number(e.target.value.replace(',', '.'))
                    if (!Number.isNaN(novoSaldo) && novoSaldo !== c.saldo_atual) {
                      aoAtualizar(c.id, { saldo_atual: novoSaldo })
                    }
                  }}
                  style={{
                    width: '100px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-display)',
                    textAlign: 'right'
                  }}
                />

                <button
                  type="button"
                  className="fixas__remover"
                  onClick={() => aoRemover(c.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="fixas__form" onSubmit={enviar}>
          <input
            type="text"
            placeholder="Ex.: Viagem para a praia"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Saldo Atual (R$)"
            value={saldo}
            onChange={(e) => setSaldo(e.target.value)}
          />
          <button type="submit" className="btn btn--primary" disabled={enviando}>
            {enviando ? '...' : '+ Criar Objetivo'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default Cofre
