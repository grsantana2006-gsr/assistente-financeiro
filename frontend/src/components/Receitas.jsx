import { useState } from 'react'
import { formatarMoeda } from '../utils/format'
import './DespesasFixas.css'

function Receitas({ receitas, bancos, aoAdicionar, aoRemover, aoAlternar }) {
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [bancoId, setBancoId] = useState(bancos[0]?.id ?? '')
  const [categoria, setCategoria] = useState('Fixo') // Fixo (Salário) ou Variável (Freelance)
  const [enviando, setEnviando] = useState(false)

  const totalAtivas = receitas.filter(r => r.ativa).reduce((soma, r) => soma + r.valor, 0)

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
      banco_id: Number(bancoId),
      categoria: categoria,
      tipo: 'Receita',
      forma_pagamento: 'Dinheiro' // Receitas geralmente não tem forma de pagamento de crédito
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
        <p className="card-subtitle">Seus salários, rendimentos e recebimentos do mês.</p>
      </div>

      <div className="card fixas">
        <div className="fixas__total" style={{ borderBottomColor: 'var(--positive)' }}>
          <p className="card-subtitle">Total (ativas)</p>
          <p className="fixas__total-valor positive">{formatarMoeda(totalAtivas)}</p>
        </div>

        {receitas.length === 0 ? (
          <p className="fixas__vazio">Nenhuma receita cadastrada ainda.</p>
        ) : (
          <ul className="fixas__lista">
            {receitas.map((r) => {
              const ativa = r.ativa
              return (
                <li key={r.id} className={`fixas__item ${ativa ? '' : 'fixas__item--pausada'}`} style={ativa ? { borderLeft: '4px solid var(--positive)' } : {}}>
                  <div className="fixas__info">
                    <span className="fixas__nome">{r.descricao}</span>
                    <span className="card-subtitle">{nomeDoBanco(r.banco_id)} &bull; {r.categoria}</span>
                  </div>
                  <span className="fixas__valor positive">+{formatarMoeda(r.valor)}</span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={ativa}
                    className={`interruptor ${ativa ? 'interruptor--ligado' : ''}`}
                    onClick={() => aoAlternar(r)}
                  />

                  <button
                    type="button"
                    className="fixas__remover"
                    onClick={() => aoRemover(r.id)}
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        )}

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
      </div>
    </section>
  )
}

export default Receitas
