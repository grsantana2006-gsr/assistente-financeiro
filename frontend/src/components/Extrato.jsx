import { useState } from 'react'
import { formatarMoeda } from '../utils/format'
import './Extrato.css'

function Extrato({ transacoes, bancos, aoAdicionar, aoRemover }) {
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [bancoId, setBancoId] = useState(bancos[0]?.id ?? '')
  const [forma, setForma] = useState('Crédito')
  const [parcelas, setParcelas] = useState('1')
  const [enviando, setEnviando] = useState(false)

  function nomeDoBanco(id) {
    return bancos.find((b) => b.id === id)?.nome ?? '—'
  }
  
  function corDoBanco(id) {
    return bancos.find((b) => b.id === id)?.cor ?? '#8b5cf6'
  }

  async function enviar(evento) {
    evento.preventDefault()
    const valorNumerico = Number(valor.replace(',', '.'))
    if (!descricao.trim() || Number.isNaN(valorNumerico) || valorNumerico <= 0) return

    setEnviando(true)
    const qtdeParcelas = Number(parcelas)
    const deuCerto = await aoAdicionar({
      descricao: descricao.trim(),
      valor: valorNumerico / qtdeParcelas, // O banco espera o valor de CADA parcela
      banco_id: Number(bancoId),
      forma_pagamento: forma,
      total_parcelas: qtdeParcelas
    })
    setEnviando(false)

    if (deuCerto) {
      setDescricao('')
      setValor('')
      setParcelas('1')
    }
  }

  // Pegamos apenas as 50 transações mais recentes para não poluir a tela
  const recentes = transacoes.slice(0, 50)

  return (
    <section id="extrato-variaveis" aria-labelledby="titulo-extrato">
      <div className="secao__cabecalho">
        <h2 id="titulo-extrato">Gastos Variáveis</h2>
        <p className="card-subtitle">Despesas do dia a dia (mercado, uber, etc.) inseridas via Bot ou formulário abaixo.</p>
      </div>

      <div className="card extrato">
        {recentes.length === 0 ? (
          <p className="extrato__vazio">Nenhum gasto variável registrado.</p>
        ) : (
          <ul className="extrato__lista">
            {recentes.map((t) => (
              <li key={t.id} className="extrato__item" style={{ borderLeftColor: corDoBanco(t.banco_id) }}>
                <div className="extrato__info">
                  <span className="extrato__nome">{t.descricao}</span>
                  <div className="extrato__detalhes">
                    <span>{new Date(t.data_compra).toLocaleDateString('pt-BR')}</span>
                    <span>&bull;</span>
                    <span>{nomeDoBanco(t.banco_id)}</span>
                    <span>&bull;</span>
                    <span>{t.forma_pagamento}</span>
                  </div>
                </div>
                <span className="extrato__valor">{formatarMoeda(t.valor)}</span>
                <button
                  type="button"
                  className="extrato__remover"
                  aria-label={`Remover ${t.descricao}`}
                  onClick={() => aoRemover(t.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="extrato__form" onSubmit={enviar}>
          <input
            type="text"
            placeholder="Ex.: Padaria"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            aria-label="Descrição"
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Valor (R$)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            aria-label="Valor"
          />
          <select
            value={bancoId}
            onChange={(e) => setBancoId(e.target.value)}
            aria-label="Banco"
          >
            {bancos.map((b) => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
          </select>
          <select
            value={forma}
            onChange={(e) => setForma(e.target.value)}
            aria-label="Forma de Pagamento"
          >
            <option value="Crédito">Crédito</option>
            <option value="Débito">Débito</option>
            <option value="PIX">PIX</option>
            <option value="Dinheiro">Dinheiro</option>
          </select>
          <select
            value={parcelas}
            onChange={(e) => setParcelas(e.target.value)}
            aria-label="Parcelas"
            title="Quantidade de parcelas"
            style={{ flex: '1 1 80px' }}
          >
            <option value="1">1x (À vista)</option>
            {[...Array(11)].map((_, i) => (
              <option key={i + 2} value={i + 2}>{i + 2}x</option>
            ))}
          </select>
          <button type="submit" className="btn btn--primary" disabled={enviando}>
            {enviando ? 'Adicionando…' : '+ Adicionar'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default Extrato
