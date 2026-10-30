import { useState } from 'react'
import { formatarMoeda, formatarDataHora, formatarMesAnoCurto } from '../utils/format'
import { obterMesFatura, rotuloMesFatura } from '../utils/fatura'
import './Extrato.css'

function formatarMesAno(anoMes) {
  if (!anoMes) return ''
  const [ano, mes] = anoMes.split('-')
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]
  const idx = parseInt(mes, 10) - 1
  return `${meses[idx] || mes}/${ano}`
}

function Extrato({ transacoes = [], bancos = [], mesReferencia, aoAdicionar, aoAtualizar, aoRemover }) {
  const mesAtualRef = mesReferencia || new Date().toISOString().slice(0, 7)
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [bancoId, setBancoId] = useState(bancos[0]?.id ?? '')
  const [forma, setForma] = useState('Crédito')
  const [parcelas, setParcelas] = useState('1')
  const [enviando, setEnviando] = useState(false)

  // Estado de edição de gasto
  const [editandoId, setEditandoId] = useState(null)
  const [editDescricao, setEditDescricao] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editBancoId, setEditBancoId] = useState('')
  const [editForma, setEditForma] = useState('Crédito')

  function iniciarEdicao(t) {
    setEditandoId(t.id)
    setEditDescricao(t.descricao)
    setEditValor(String(t.valor).replace('.', ','))
    setEditBancoId(String(t.banco_id))
    setEditForma(t.forma_pagamento || 'Crédito')
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
        forma_pagamento: editForma,
      })
    }
    setEditandoId(null)
  }

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
      total_parcelas: qtdeParcelas,
      data_compra: new Date().toISOString(),
    })
    setEnviando(false)

    if (deuCerto) {
      setDescricao('')
      setValor('')
      setParcelas('1')
    }
  }

  function pertenceAoMes(t, mesRef) {
    const banco = bancos.find((b) => b.id === t.banco_id)
    const ehCredito = t.forma_pagamento === 'Crédito' && banco && banco.tipo !== 'Benefício'
    const mesDestino = ehCredito
      ? obterMesFatura(t.data_compra, banco.dia_fechamento, banco.dia_vencimento)
      : (t.data_compra ? t.data_compra.slice(0, 7) : null)

    if (!mesDestino) return false

    if (t.total_parcelas > 1) {
      const [anoRef, mRef] = mesRef.split('-').map(Number)
      const [anoIni, mIni] = mesDestino.split('-').map(Number)
      const diffMeses = (anoRef - anoIni) * 12 + (mRef - mIni)
      const numParcela = (t.parcela_atual || 1) + diffMeses
      return numParcela >= 1 && numParcela <= t.total_parcelas
    }

    return mesDestino === mesRef
  }

  const transacoesDoMes = transacoes.filter((t) => pertenceAoMes(t, mesAtualRef))
  const transacoesExibidas = filtroPeriodo === 'mes' ? transacoesDoMes : transacoes.slice(0, 50)

  const bancoSelecionado = bancos.find((b) => b.id === Number(bancoId || bancos[0]?.id))
  const mesFaturaPrevista =
    forma === 'Crédito' && bancoSelecionado && bancoSelecionado.tipo !== 'Benefício'
      ? obterMesFatura(new Date().toISOString(), bancoSelecionado.dia_fechamento, bancoSelecionado.dia_vencimento)
      : null

  return (
    <section id="extrato-variaveis" aria-labelledby="titulo-extrato">
      <div className="secao__cabecalho">
        <h2 id="titulo-extrato">Gastos Variáveis</h2>
        <p className="card-subtitle">
          Despesas do dia a dia inseridas via Bot ou formulário abaixo. Exibindo {filtroPeriodo === 'mes' ? `gastos de ${formatarMesAno(mesAtualRef)}` : 'todas as compras recentes'}.
        </p>
      </div>

      <div className="card extrato">
        {/* Filtros de Período */}
        <div className="extrato__filtros" role="group" aria-label="Filtrar período do extrato">
          <button
            type="button"
            className={`extrato__filtro-btn ${filtroPeriodo === 'mes' ? 'extrato__filtro-btn--ativo' : ''}`}
            onClick={() => setFiltroPeriodo('mes')}
          >
            Deste Mês ({formatarMesAnoCurto(mesAtualRef)} - {transacoesDoMes.length})
          </button>
          <button
            type="button"
            className={`extrato__filtro-btn ${filtroPeriodo === 'todos' ? 'extrato__filtro-btn--ativo' : ''}`}
            onClick={() => setFiltroPeriodo('todos')}
          >
            Todas as Compras ({transacoes.length})
          </button>
        </div>

        {transacoesExibidas.length === 0 ? (
          <p className="extrato__vazio">
            {filtroPeriodo === 'mes'
              ? `Nenhum gasto variável registrado para ${formatarMesAno(mesAtualRef)}.`
              : 'Nenhum gasto variável registrado.'}
          </p>
        ) : (
          <ul className="extrato__lista">
            {transacoesExibidas.map((t) => {
              const banco = bancos.find((b) => b.id === t.banco_id)
              const mesFatura =
                t.forma_pagamento === 'Crédito' && banco && banco.tipo !== 'Benefício'
                  ? obterMesFatura(t.data_compra, banco.dia_fechamento, banco.dia_vencimento)
                  : null

              const emEdicao = editandoId === t.id

              return (
                <li key={t.id} className="extrato__item" style={{ borderLeftColor: corDoBanco(t.banco_id) }}>
                  {emEdicao ? (
                    <div className="extrato__edicao-inline">
                      <div className="extrato__edicao-campos">
                        <input
                          type="text"
                          className="extrato__edit-input extrato__edit-input--desc"
                          value={editDescricao}
                          onChange={(e) => setEditDescricao(e.target.value)}
                          placeholder="Descrição"
                          aria-label="Descrição do gasto"
                        />
                        <input
                          type="text"
                          className="extrato__edit-input extrato__edit-input--valor"
                          value={editValor}
                          onChange={(e) => setEditValor(e.target.value)}
                          placeholder="Valor R$"
                          aria-label="Valor do gasto"
                        />
                        <select
                          className="extrato__edit-select"
                          value={editBancoId}
                          onChange={(e) => setEditBancoId(e.target.value)}
                          aria-label="Banco"
                        >
                          {bancos.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.nome}
                            </option>
                          ))}
                        </select>
                        <select
                          className="extrato__edit-select"
                          value={editForma}
                          onChange={(e) => setEditForma(e.target.value)}
                          aria-label="Forma de pagamento"
                        >
                          <option value="Crédito">Crédito</option>
                          <option value="Débito">Débito</option>
                          <option value="PIX">PIX</option>
                          <option value="Dinheiro">Dinheiro</option>
                          <option value="Voucher">Voucher</option>
                        </select>
                      </div>
                      <div className="extrato__edit-acoes">
                        <button
                          type="button"
                          className="extrato__btn-salvar"
                          title="Salvar alterações"
                          onClick={() => salvarEdicao(t.id)}
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          className="extrato__btn-cancelar"
                          title="Cancelar edição"
                          onClick={cancelarEdicao}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="extrato__info">
                        <span className="extrato__nome">{t.descricao}</span>
                        <div className="extrato__detalhes">
                          <span className="extrato__data-hora" title="Data e hora do lançamento">
                            {formatarDataHora(t.data_compra)}
                          </span>
                          <span>&bull;</span>
                          <span>{nomeDoBanco(t.banco_id)}</span>
                          <span>&bull;</span>
                          <span>{t.forma_pagamento}</span>
                          {mesFatura && (
                            <>
                              <span>&bull;</span>
                              <span className="extrato__tag-fatura" title={`Vence na fatura de ${rotuloMesFatura(mesFatura)}`}>
                                Fatura: {rotuloMesFatura(mesFatura)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="extrato__valor">{formatarMoeda(t.valor)}</span>
                      <div className="extrato__acoes">
                        <button
                          type="button"
                          className="extrato__btn-editar"
                          aria-label={`Editar ${t.descricao}`}
                          title="Editar este gasto"
                          onClick={() => iniciarEdicao(t)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="extrato__remover"
                          aria-label={`Remover ${t.descricao}`}
                          title="Excluir este gasto"
                          onClick={() => aoRemover(t.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </>
                  )}
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
                {b.nome}
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
            <option value="Crédito">Crédito</option>
            <option value="Débito">Débito</option>
            <option value="PIX">PIX</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="Voucher">Voucher (Vale Refeição)</option>
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
