import { useState } from 'react'
import { formatarMoeda, formatarMesAnoCurto } from '../utils/format'
import './DespesasFixas.css'

function Receitas({ receitas = [], bancos = [], mesReferencia, aoAdicionar, aoAtualizar, aoRemover, aoAlternar }) {
  const mesAtualRef = mesReferencia || new Date().toISOString().slice(0, 7)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [bancoId, setBancoId] = useState(bancos[0]?.id ?? '')
  const [categoria, setCategoria] = useState('Fixo') // Fixo (Salário) ou Variável (Freelance)
  const [enviando, setEnviando] = useState(false)

  // Estado de edição de receita
  const [editandoId, setEditandoId] = useState(null)
  const [editDescricao, setEditDescricao] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editBancoId, setEditBancoId] = useState('')
  const [editCategoria, setEditCategoria] = useState('Fixo')

  function iniciarEdicao(r) {
    setEditandoId(r.id)
    setEditDescricao(r.descricao)
    setEditValor(String(r.valor).replace('.', ','))
    setEditBancoId(String(r.banco_id))
    setEditCategoria(r.categoria || 'Fixo')
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditDescricao('')
    setEditValor('')
  }

  async function salvarEdicao(id) {
    const valorNumerico = Number(editValor.replace(',', '.'))
    if (!editDescricao.trim() || Number.isNaN(valorNumerico) || valorNumerico <= 0) return
    if (aoAtualizar) {
      await aoAtualizar(id, {
        descricao: editDescricao.trim(),
        valor: valorNumerico,
        banco_id: Number(editBancoId),
        categoria: editCategoria,
      })
    }
    setEditandoId(null)
  }

  const receitasDoMes = receitas.filter((r) => {
    if (!r.ativa) return false
    const mesInicio = r.data_compra ? r.data_compra.slice(0, 7) : null
    if (r.categoria === 'Fixo') {
      return !mesInicio || mesInicio <= mesAtualRef
    }
    return r.data_compra && r.data_compra.startsWith(mesAtualRef)
  })

  const totalAtivas = receitasDoMes.reduce((soma, r) => soma + r.valor, 0)

  function nomeDoBanco(id) {
    return bancos.find((b) => b.id === id)?.nome ?? '—'
  }

  async function enviar(evento) {
    evento.preventDefault()
    const valorNumerico = Number(valor.replace(',', '.'))
    if (!descricao.trim() || Number.isNaN(valorNumerico) || valorNumerico <= 0) return

    setEnviando(true)
    const deuCerto = await aoAdicionar({
      descricao: descricao.trim(),
      valor: valorNumerico,
      banco_id: Number(bancoId || bancos[0]?.id),
      categoria: categoria,
      tipo: 'Receita',
      forma_pagamento: 'Dinheiro',
      data_compra: `${mesAtualRef}-01`,
    })
    setEnviando(false)

    if (deuCerto) {
      setDescricao('')
      setValor('')
    }
  }

  return (
    <section aria-labelledby="titulo-receitas">
      <div className="secao__cabecalho">
        <h2 id="titulo-receitas">Receitas & Entradas</h2>
        <p className="card-subtitle">Seus salários, rendimentos e recebimentos do mês ({formatarMesAnoCurto(mesAtualRef)}).</p>
      </div>

      <div className="card fixas">
        <div className="fixas__total" style={{ borderBottomColor: 'var(--positive)' }}>
          <p className="card-subtitle">Total do Mês ({formatarMesAnoCurto(mesAtualRef)})</p>
          <p className="fixas__total-valor positive">{formatarMoeda(totalAtivas)}</p>
        </div>

        {/* Formulário de adicionar nova receita no topo */}
        <form className="fixas__form" onSubmit={enviar}>
          <input
            type="text"
            placeholder="Ex.: Salário"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Valor (R$)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="Fixo">Mensal (Fixo)</option>
            <option value="Variável">Avulso (Variável)</option>
          </select>
          <select value={bancoId} onChange={(e) => setBancoId(e.target.value)}>
            {bancos.map((b) => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
          </select>
          <button type="submit" className="btn btn--primary" style={{ background: 'var(--positive)', borderColor: 'var(--positive)' }} disabled={enviando}>
            {enviando ? '...' : '+ Adicionar'}
          </button>
        </form>

        {receitas.length === 0 ? (
          <p className="fixas__vazio">Nenhuma receita cadastrada ainda.</p>
        ) : (
          <ul className="fixas__lista">
            {receitas.map((r) => {
              const ativa = r.ativa
              const emEdicao = editandoId === r.id

              return (
                <li key={r.id} className={`fixas__item ${ativa ? '' : 'fixas__item--pausada'}`} style={ativa ? { borderLeft: '4px solid var(--positive)' } : {}}>
                  {emEdicao ? (
                    <div className="fixas__edicao-inline">
                      <input
                        type="text"
                        className="fixas__edit-input fixas__edit-input--desc"
                        value={editDescricao}
                        onChange={(e) => setEditDescricao(e.target.value)}
                        placeholder="Descrição"
                        aria-label="Descrição da receita"
                      />
                      <input
                        type="text"
                        className="fixas__edit-input fixas__edit-input--valor"
                        value={editValor}
                        onChange={(e) => setEditValor(e.target.value)}
                        placeholder="Valor R$"
                        aria-label="Valor da receita"
                      />
                      <select
                        className="fixas__edit-input"
                        value={editBancoId}
                        onChange={(e) => setEditBancoId(e.target.value)}
                        aria-label="Banco de recebimento"
                      >
                        {bancos.map((b) => (
                          <option key={b.id} value={b.id}>{b.nome}</option>
                        ))}
                      </select>
                      <select
                        className="fixas__edit-input"
                        value={editCategoria}
                        onChange={(e) => setEditCategoria(e.target.value)}
                        aria-label="Categoria da receita"
                      >
                        <option value="Fixo">Fixo (Salário)</option>
                        <option value="Variável">Variável (Extra)</option>
                      </select>
                      <div className="fixas__edit-acoes">
                        <button
                          type="button"
                          className="fixas__btn-salvar"
                          title="Salvar alterações"
                          onClick={() => salvarEdicao(r.id)}
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
                        <span className="fixas__nome">{r.descricao}</span>
                        <span className="card-subtitle">{nomeDoBanco(r.banco_id)} &bull; {r.categoria}</span>
                      </div>
                      <span className="fixas__valor positive">+{formatarMoeda(r.valor)}</span>

                      <button
                        type="button"
                        className="fixas__btn-editar"
                        aria-label={`Editar ${r.descricao}`}
                        title="Editar esta receita"
                        onClick={() => iniciarEdicao(r)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={ativa}
                        aria-label={`${ativa ? 'Pausar' : 'Ativar'} ${r.descricao}`}
                        className={`interruptor ${ativa ? 'interruptor--ligado' : ''}`}
                        onClick={() => aoAlternar(r)}
                      />

                      <button
                        type="button"
                        className="fixas__remover"
                        aria-label={`Remover ${r.descricao}`}
                        onClick={() => aoRemover(r.id)}
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

export default Receitas
