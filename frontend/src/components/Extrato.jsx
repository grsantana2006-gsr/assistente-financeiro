import { useState } from 'react'
import { formatarMoeda } from '../utils/format'
import { obterMesFatura, rotuloMesFatura } from '../utils/fatura'
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
      banco_id: Number(bancoId || bancos[0]?.id),
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

  const bancoSelecionado = bancos.find((b) => b.id === Number(bancoId || bancos[0]?.id))
  const mesFaturaPrevista =
    forma === 'Crédito' && bancoSelecionado && bancoSelecionado.tipo !== 'Benefício'
      ? obterMesFatura(new Date().toISOString(), bancoSelecionado.dia_fechamento, bancoSelecionado.dia_vencimento)
      : null

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
            {recentes.map((t) => {
              const banco = bancos.find((b) => b.id === t.banco_id)
              const mesFatura =
                t.forma_pagamento === 'Crédito' && banco && banco.tipo !== 'Benefício'
                  ? obterMesFatura(t.data_compra, banco.dia_fechamento, banco.dia_vencimento)
                  : null

              return (
                <li key={t.id} className="extrato__item" style={{ borderLeftColor: corDoBanco(t.banco_id) }}>
                  <div className="extrato__info">
                    <span className="extrato__nome">{t.descricao}</span>
                    <div className="extrato__detalhes">
                      <span>{new Date(t.data_compra).toLocaleDateString('pt-BR')}</span>
                      <span>&bull;</span>
                      <span>{nomeDoBanco(t.banco_id)}</span>
                      <span>&bull;</span>
                      <span>{t.forma_pagamento}</span>
                      {mesFatura && (
                        <>
                          <span>&bull;</span>
                          <span className="extrato__tag-fatura" title={`Vence na fatura de ${rotuloMesFatura(mesFatura)}`}>
                            📅 Fatura: {rotuloMesFatura(mesFatura)}
                          </span>
                        </>
                      )}
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
              )
            })}
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
            aria-label="Banco / Cartão de Origem"
          >
            {bancos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.tipo === 'Benefício' ? `🍽️ ${b.nome}` : b.nome}
              </option>
            ))}
          </select>
          <select
            value={forma}
            onChange={(e) => {
              const novaForma = e.target.value
              setForma(novaForma)
              if (novaForma === 'Voucher') {
                const vr = bancos.find(
                  (b) =>
                    b.tipo === 'Benefício' ||
                    b.nome.toLowerCase().includes('refeição') ||
                    b.nome.toLowerCase().includes('vale'),
                )
                if (vr) setBancoId(vr.id)
              }
            }}
            aria-label="Forma de Pagamento"
          >
            <option value="Crédito">💳 Crédito</option>
            <option value="Débito">🏦 Débito</option>
            <option value="PIX">⚡ PIX</option>
            <option value="Dinheiro">💵 Dinheiro</option>
            <option value="Voucher">🍽️ Voucher (Vale Refeição)</option>
          </select>
          <select
            value={parcelas}
            onChange={(e) => setParcelas(e.target.value)}
            aria-label="Parcelas"
            title="Quantidade de parcelas"
            style={{ flex: '1 1 80px' }}
            disabled={forma === 'Voucher'}
          >
            <option value="1">1x (À vista)</option>
            {[...Array(11)].map((_, i) => (
              <option key={i + 2} value={i + 2}>{i + 2}x</option>
            ))}
          </select>
          <button type="submit" className="btn btn--primary" disabled={enviando}>
            {enviando ? 'Adicionando…' : '+ Adicionar'}
          </button>

          {mesFaturaPrevista && bancoSelecionado && (
            <div className="extrato__dica-fatura">
              <span className="extrato__dica-icone" aria-hidden="true">ℹ️</span>
              <div className="extrato__dica-conteudo">
                Compras no <strong>{bancoSelecionado.nome}</strong> hoje entram na fatura de{' '}
                <strong className="extrato__dica-mes">{rotuloMesFatura(mesFaturaPrevista)}</strong>
                <span className="extrato__dica-datas">
                  {' '}(fecha dia {bancoSelecionado.dia_fechamento} • vence dia {bancoSelecionado.dia_vencimento})
                </span>
              </div>
            </div>
          )}
        </form>
      </div>
    </section>
  )
}

export default Extrato
