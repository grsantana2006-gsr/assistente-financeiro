import { useState } from 'react'
import { formatarMoeda } from '../utils/format'
import './DespesasFixas.css'

function Cofre({ cofre, aoAdicionar, aoAtualizar, aoRemover }) {
  const [objetivo, setObjetivo] = useState('')
  const [saldo, setSaldo] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Estado de edição
  const [editandoId, setEditandoId] = useState(null)
  const [editObjetivo, setEditObjetivo] = useState('')
  const [editSaldo, setEditSaldo] = useState('')

  function iniciarEdicao(c) {
    setEditandoId(c.id)
    setEditObjetivo(c.objetivo)
    setEditSaldo(String(c.saldo_atual).replace('.', ','))
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditObjetivo('')
    setEditSaldo('')
  }

  async function salvarEdicao(id) {
    const valorNumerico = Number(editSaldo.replace(',', '.'))
    if (!editObjetivo.trim() || Number.isNaN(valorNumerico) || valorNumerico < 0) return
    if (aoAtualizar) {
      await aoAtualizar(id, {
        objetivo: editObjetivo.trim(),
        saldo_atual: valorNumerico,
      })
    }
    setEditandoId(null)
  }

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

        {/* Formulário de criar objetivo no topo */}
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

        {itens.length === 0 ? (
          <p className="fixas__vazio">Nenhum objetivo cadastrado.</p>
        ) : (
          <ul className="fixas__lista">
            {itens.map((c) => {
              const emEdicao = editandoId === c.id

              return (
                <li key={c.id} className="fixas__item" style={{ borderLeft: '4px solid var(--primary)' }}>
                  {emEdicao ? (
                    <div className="fixas__edicao-inline">
                      <input
                        type="text"
                        className="fixas__edit-input fixas__edit-input--desc"
                        value={editObjetivo}
                        onChange={(e) => setEditObjetivo(e.target.value)}
                        placeholder="Nome do objetivo"
                        aria-label="Nome do objetivo"
                      />
                      <input
                        type="text"
                        className="fixas__edit-input fixas__edit-input--valor"
                        value={editSaldo}
                        onChange={(e) => setEditSaldo(e.target.value)}
                        placeholder="Saldo R$"
                        aria-label="Saldo atual do objetivo"
                      />
                      <div className="fixas__edit-acoes">
                        <button
                          type="button"
                          className="fixas__btn-salvar"
                          title="Salvar alterações"
                          onClick={() => salvarEdicao(c.id)}
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          className="fixas__btn-cancelar"
                          title="Cancelar edição"
                          onClick={cancelarEdicao}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="fixas__info">
                        <span className="fixas__nome">{c.objetivo}</span>
                      </div>
                      <span className="fixas__valor" style={{ color: 'var(--primary)' }}>
                        {formatarMoeda(c.saldo_atual)}
                      </span>

                      <button
                        type="button"
                        className="fixas__btn-editar"
                        aria-label={`Editar ${c.objetivo}`}
                        title="Editar saldo e objetivo"
                        onClick={() => iniciarEdicao(c)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className="fixas__remover"
                        aria-label={`Remover ${c.objetivo}`}
                        onClick={() => aoRemover(c.id)}
                      >
                        Excluir
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default Cofre
