import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { formatarMoeda } from '../utils/format'
import { formatarMesExtenso } from '../utils/meses'
import SeletorMes from './SeletorMes'
import './StatusHeader.css'

function formatarDataSimples(dataStr) {
  if (!dataStr) return '—'
  const parteData = dataStr.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(parteData)) {
    const [ano, mes, dia] = parteData.split('-')
    return `${dia}/${mes}/${ano}`
  }
  return dataStr
}

function StatusHeader({
  totalCofre,
  receitaMes,
  faturasCartao,
  faturasCartaoBruto,
  faturasPagasTotal = 0,
  faturasPendentesTotal = 0,
  faturasAdiantadasTotal = 0,
  qtdFaturasPagas = 0,
  qtdFaturasTotal = 0,
  todasFaturasPagas = false,
  despesasContaPix,
  saldoMes,
  statusMes,
  mesReferencia,
  aoMudarMes,
  itensFaturas = [],
  itensContaPix = [],
  cartoes = [],
}) {
  const ehPositivo = (statusMes ?? (saldoMes >= 0 ? 'positivo' : 'negativo')) === 'positivo'

  // Controle de abertura do modal de detalhamento ('faturas' | 'debito-pix' | null)
  const [modalAberto, setModalAberto] = useState(null)
  const [termoBusca, setTermoBusca] = useState('')
  const [filtroBanco, setFiltroBanco] = useState('todos')

  function abrirModal(tipo) {
    setModalAberto(tipo)
    setTermoBusca('')
    setFiltroBanco('todos')
  }

  function fecharModal() {
    setModalAberto(null)
    setTermoBusca('')
    setFiltroBanco('todos')
  }

  // Fechar com a tecla ESC e travar rolagem do body quando modal aberto
  useEffect(() => {
    function tratarKeyDown(e) {
      if (e.key === 'Escape') fecharModal()
    }
    if (modalAberto) {
      window.addEventListener('keydown', tratarKeyDown)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      window.removeEventListener('keydown', tratarKeyDown)
      document.body.style.overflow = ''
    }
  }, [modalAberto])

  const cartoesCredito = useMemo(() => {
    return cartoes.filter((c) => c.tipo !== 'Benefício')
  }, [cartoes])

  const bancosDisponiveisFaturas = useMemo(() => {
    const nomes = new Set()
    itensFaturas.forEach((it) => {
      if (it.banco_nome) nomes.add(it.banco_nome)
    })
    return Array.from(nomes)
  }, [itensFaturas])

  const itensFaturasFiltrados = useMemo(() => {
    return itensFaturas.filter((t) => {
      const casaTexto =
        !termoBusca ||
        t.descricao.toLowerCase().includes(termoBusca.toLowerCase()) ||
        (t.categoria && t.categoria.toLowerCase().includes(termoBusca.toLowerCase())) ||
        (t.banco_nome && t.banco_nome.toLowerCase().includes(termoBusca.toLowerCase()))

      const casaBanco = filtroBanco === 'todos' || t.banco_nome === filtroBanco
      return casaTexto && casaBanco
    })
  }, [itensFaturas, termoBusca, filtroBanco])

  const itensContaPixFiltrados = useMemo(() => {
    return itensContaPix.filter((t) => {
      return (
        !termoBusca ||
        t.descricao.toLowerCase().includes(termoBusca.toLowerCase()) ||
        (t.categoria && t.categoria.toLowerCase().includes(termoBusca.toLowerCase())) ||
        (t.banco_nome && t.banco_nome.toLowerCase().includes(termoBusca.toLowerCase())) ||
        (t.forma_pagamento && t.forma_pagamento.toLowerCase().includes(termoBusca.toLowerCase()))
      )
    })
  }, [itensContaPix, termoBusca])

  const indicadores = [
    { id: 'cofre', rotulo: 'Dinheiro no Cofre', valor: totalCofre, classe: '', clicavel: false },
    { id: 'receita', rotulo: 'Receita do Mês', valor: receitaMes, classe: 'positive', clicavel: false },
    {
      id: 'faturas',
      rotulo: todasFaturasPagas
        ? 'Faturas do Mês (Quitadas)'
        : faturasPagasTotal > 0
          ? 'Faturas a Cargo do Salário'
          : 'Faturas de Cartão',
      valor: faturasCartao,
      sub: todasFaturasPagas
        ? `100% quitadas com o salário (${formatarMoeda(faturasPagasTotal)})`
        : faturasPagasTotal > 0
          ? `${formatarMoeda(faturasPendentesTotal)} a pagar no caixa (${formatarMoeda(faturasPagasTotal)} quitado)`
          : qtdFaturasTotal > 0
            ? `${qtdFaturasTotal} fatura(s) a pagar`
            : null,
      classe: todasFaturasPagas ? 'positive' : faturasPendentesTotal > 0 ? 'negative' : 'positive',
      clicavel: true,
      dica: 'Clique para ver despesas do cartão',
    },
    {
      id: 'debito-pix',
      rotulo: 'Débito & PIX (Conta)',
      valor: despesasContaPix,
      sub: 'Saídas diretas do saldo bancário',
      classe: 'warning',
      clicavel: true,
      dica: 'Clique para ver despesas de conta/PIX',
    },
  ]

  return (
    <header className="status-header">
      <div className="status-header__topo fade-up">
        <div className="status-header__intro">
          <p className="status-header__eyebrow">Assistente Financeiro</p>
          <h1 className="status-header__title">
            Olá, Guilherme
          </h1>
          <p className="card-subtitle">
            {mesReferencia
              ? `Saúde financeira de ${formatarMesExtenso(mesReferencia)}.`
              : 'Veja como está sua saúde financeira neste mês.'}
          </p>
        </div>

        {mesReferencia && aoMudarMes && (
          <SeletorMes mesReferencia={mesReferencia} aoMudarMes={aoMudarMes} />
        )}
      </div>

      {/* Banner de Veredito */}
      <section
        id="status-veredito"
        className={`status-banner ${ehPositivo ? 'status-banner--positivo' : 'status-banner--negativo'} fade-up`}
        aria-label="Veredito financeiro do mês"
      >
        <div className="status-banner__info">
          <p className="status-banner__status">
            {ehPositivo
              ? 'Você está no Azul (Superávit) neste mês!'
              : 'Atenção: Você está no Vermelho (Déficit) neste mês!'}
          </p>
          <p className="status-banner__detalhe">
            {ehPositivo
              ? 'Suas receitas superam o total de faturas e saídas em '
              : 'Seus compromissos superam suas receitas em '}
            <strong className={ehPositivo ? 'positive' : 'negative'}>
              {formatarMoeda(Math.abs(saldoMes))}
            </strong>
            {ehPositivo ? ' de margem livre.' : ' (gastando mais do que ganha).'}
          </p>

          {faturasPagasTotal > 0 && (
            <div className="status-banner__esclarecimento">
              <span className="status-banner__esclarecimento-tag">Faturas quitadas</span>
              <span className="status-banner__esclarecimento-texto">
                O saldo real de <strong>{formatarMoeda(saldoMes)}</strong> reflete suas despesas reais: a fatura quitada no mês ({formatarMoeda(faturasPagasTotal)}) foi paga com o seu salário{faturasPendentesTotal > 0 ? `, restando ${formatarMoeda(faturasPendentesTotal)} a pagar` : ''}. Esse valor não volta como sobra porque já foi utilizado para quitar o cartão.
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Grid com 4 Indicadores */}
      <section className="status-header__grid" aria-label="Indicadores globais">
        {indicadores.map((item, i) => {
          const ehInterativo = item.clicavel
          return (
            <article
              key={item.id}
              id={`indicador-${item.id}`}
              className={`card status-card fade-up ${ehInterativo ? 'status-card--interativo' : ''}`}
              style={{ animationDelay: `${0.08 * (i + 1)}s` }}
              onClick={ehInterativo ? () => abrirModal(item.id) : undefined}
              onKeyDown={
                ehInterativo
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        abrirModal(item.id)
                      }
                    }
                  : undefined
              }
              role={ehInterativo ? 'button' : undefined}
              tabIndex={ehInterativo ? 0 : undefined}
              aria-haspopup={ehInterativo ? 'dialog' : undefined}
              title={ehInterativo ? item.dica : undefined}
            >
              <div className="status-card__topo-card">
                <p className="card-subtitle">{item.rotulo}</p>
                {ehInterativo && (
                  <span className="status-card__tag-ver" aria-hidden="true">
                    Ver despesas ↗
                  </span>
                )}
              </div>
              <p className={`status-card__value ${item.classe}`}>{formatarMoeda(item.valor)}</p>
              {item.sub && <span className="status-card__sub">{item.sub}</span>}
            </article>
          )
        })}
      </section>

      {/* Modal Interativo para Detalhamento dos Cards */}
      {modalAberto &&
        createPortal(
          <div className="status-modal-overlay" onClick={fecharModal} role="presentation">
            <div
              className="status-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="status-modal-titulo"
            >
              {/* Cabeçalho do Modal */}
              <div className="status-modal__cabecalho">
                <div>
                  <h3 id="status-modal-titulo" className="status-modal__titulo">
                    {modalAberto === 'faturas' ? 'Faturas de Cartão (Crédito)' : 'Débito & PIX (Conta Corrente)'}
                  </h3>
                  <p className="status-modal__sub">
                    {modalAberto === 'faturas'
                      ? `Despesas cobradas na fatura do mês (${formatarMesExtenso(mesReferencia)})`
                      : `Saídas diretas do saldo bancário no mês (${formatarMesExtenso(mesReferencia)})`}
                  </p>
                </div>
                <button
                  type="button"
                  className="status-modal__fechar"
                  onClick={fecharModal}
                  aria-label="Fechar janela"
                >
                  ✕
                </button>
              </div>

              {/* Corpo do Modal */}
              <div className="status-modal__corpo">
                {modalAberto === 'faturas' && (
                  <>
                    {/* Resumo por Cartão */}
                    {cartoesCredito.length > 0 && (
                      <div className="status-modal__bancos-resumo">
                        <span className="status-modal__secao-label">Resumo por Banco:</span>
                        <div className="status-modal__bancos-grid">
                          {cartoesCredito.map((c) => (
                            <div key={c.id} className="status-modal__banco-card">
                              <div className="status-modal__banco-header">
                                <span className="status-modal__banco-nome">{c.nome}</span>
                                <span
                                  className={`status-modal__badge-status ${
                                    c.fatura_paga ? 'badge--paga' : c.fatura_parcial ? 'badge--parcial' : 'badge--aberta'
                                  }`}
                                >
                                  {c.fatura_paga ? 'Quitada' : c.fatura_parcial ? 'Parcial' : 'Pendente'}
                                </span>
                              </div>
                              <div className="status-modal__banco-numeros">
                                <span className="status-modal__banco-valor">
                                  Fatura Total: <strong>{formatarMoeda(c.valor_fatura || 0)}</strong>
                                </span>
                                {c.valor_adiantamentos > 0 && (
                                  <span className="status-modal__banco-adiantado" style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>
                                    Adiantado: -{formatarMoeda(c.valor_adiantamentos)}
                                  </span>
                                )}
                                <span className="status-modal__banco-cargo">
                                  A cargo do salário: <strong>{formatarMoeda(c.valor_cargo_salario ?? c.valor_fatura ?? 0)}</strong>
                                </span>
                                {c.fatura_paga ? (
                                  <span className="status-modal__banco-pago positive" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                    Quitada no mês com salário
                                  </span>
                                ) : (
                                  <span className="status-modal__banco-restante negative" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                    Falta pagar: {formatarMoeda(c.saldo_restante_fatura ?? 0)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Filtros e Busca */}
                    <div className="status-modal__filtros">
                      <div className="status-modal__campo-busca">
                        <input
                          type="text"
                          placeholder="Buscar despesa ou estabelecimento..."
                          value={termoBusca}
                          onChange={(e) => setTermoBusca(e.target.value)}
                          className="status-modal__input"
                        />
                        {termoBusca && (
                          <button
                            type="button"
                            className="status-modal__btn-limpar-busca"
                            onClick={() => setTermoBusca('')}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {bancosDisponiveisFaturas.length > 1 && (
                        <div className="status-modal__banco-chips" role="group" aria-label="Filtrar por cartão">
                          <button
                            type="button"
                            className={`status-modal__chip ${filtroBanco === 'todos' ? 'status-modal__chip--ativo' : ''}`}
                            onClick={() => setFiltroBanco('todos')}
                          >
                            Todos ({itensFaturas.length})
                          </button>
                          {bancosDisponiveisFaturas.map((bNome) => {
                            const qtd = itensFaturas.filter((it) => it.banco_nome === bNome).length
                            return (
                              <button
                                key={bNome}
                                type="button"
                                className={`status-modal__chip ${filtroBanco === bNome ? 'status-modal__chip--ativo' : ''}`}
                                onClick={() => setFiltroBanco(bNome)}
                              >
                                {bNome} ({qtd})
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Lista de Despesas */}
                    <div className="status-modal__lista-container">
                      <div className="status-modal__lista-cabecalho">
                        <span>Despesa / Cartão</span>
                        <span>Valor</span>
                      </div>

                      {itensFaturasFiltrados.length > 0 ? (
                        <ul className="status-modal__lista">
                          {itensFaturasFiltrados.map((it) => (
                            <li key={it.id} className="status-modal__item">
                              <div className="status-modal__item-info">
                                <span className="status-modal__item-desc">{it.descricao}</span>
                                <div className="status-modal__item-tags">
                                  <span className="status-modal__tag status-modal__tag--banco">
                                    {it.banco_nome}
                                  </span>
                                  {it.total_parcelas > 1 ? (
                                    <span className="status-modal__tag status-modal__tag--parcela">
                                      {it.parcela_atual || 1}/{it.total_parcelas}
                                    </span>
                                  ) : (
                                    <span className="status-modal__tag status-modal__tag--a-vista">
                                      À vista
                                    </span>
                                  )}
                                  {it.categoria && (
                                    <span className="status-modal__tag status-modal__tag--cat">
                                      {it.categoria}
                                    </span>
                                  )}
                                  {it.data_compra && (
                                    <span className="status-modal__item-data">
                                      {formatarDataSimples(it.data_compra)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="status-modal__item-valor negative">
                                {formatarMoeda(it.valor)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="status-modal__vazio">
                          <p>Nenhuma despesa de cartão encontrada para os filtros atuais.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {modalAberto === 'debito-pix' && (
                  <>
                    <div className="status-modal__aviso-contexto">
                      <p>
                        Estes valores foram debitados ou agendados para sair diretamente do saldo da sua conta
                        corrente (PIX, débito ou dinheiro). Não acumulam fatura e consomem caixa de imediato.
                      </p>
                    </div>

                    {/* Busca */}
                    <div className="status-modal__filtros">
                      <div className="status-modal__campo-busca">
                        <input
                          type="text"
                          placeholder="Buscar despesa em débito ou PIX..."
                          value={termoBusca}
                          onChange={(e) => setTermoBusca(e.target.value)}
                          className="status-modal__input"
                        />
                        {termoBusca && (
                          <button
                            type="button"
                            className="status-modal__btn-limpar-busca"
                            onClick={() => setTermoBusca('')}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Lista de Despesas */}
                    <div className="status-modal__lista-container">
                      <div className="status-modal__lista-cabecalho">
                        <span>Despesa / Conta</span>
                        <span>Valor</span>
                      </div>

                      {itensContaPixFiltrados.length > 0 ? (
                        <ul className="status-modal__lista">
                          {itensContaPixFiltrados.map((it) => (
                            <li key={it.id} className="status-modal__item">
                              <div className="status-modal__item-info">
                                <span className="status-modal__item-desc">{it.descricao}</span>
                                <div className="status-modal__item-tags">
                                  <span className="status-modal__tag status-modal__tag--forma">
                                    {it.forma_pagamento || 'PIX / Débito'}
                                  </span>
                                  <span className="status-modal__tag status-modal__tag--banco">
                                    {it.banco_nome}
                                  </span>
                                  {it.categoria && (
                                    <span className="status-modal__tag status-modal__tag--cat">
                                      {it.categoria}
                                    </span>
                                  )}
                                  {it.data_compra && (
                                    <span className="status-modal__item-data">
                                      {formatarDataSimples(it.data_compra)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="status-modal__item-valor warning">
                                {formatarMoeda(it.valor)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="status-modal__vazio">
                          <p>Nenhuma despesa em débito ou PIX encontrada para este mês.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Rodapé do Modal */}
              <div className="status-modal__rodape">
                {modalAberto === 'faturas' ? (
                  <div className="status-modal__totais">
                    <div className="status-modal__total-bloco">
                      <span className="status-modal__total-label">Faturas no Cartão:</span>
                      <strong className="status-modal__total-num">{formatarMoeda(faturasCartao)}</strong>
                    </div>
                    {faturasPagasTotal > 0 && (
                      <div className="status-modal__total-bloco">
                        <span className="status-modal__total-label">Quitado / Adiantado:</span>
                        <strong className="status-modal__total-num positive">{formatarMoeda(faturasPagasTotal)}</strong>
                      </div>
                    )}
                    <div className="status-modal__total-bloco">
                      <span className="status-modal__total-label">Saldo a Pagar:</span>
                      <strong
                        className={`status-modal__total-num ${
                          faturasPendentesTotal > 0 ? 'negative' : 'positive'
                        }`}
                      >
                        {formatarMoeda(faturasPendentesTotal)}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="status-modal__totais">
                    <div className="status-modal__total-bloco">
                      <span className="status-modal__total-label">Total Débito & PIX:</span>
                      <strong className="status-modal__total-num warning">{formatarMoeda(despesasContaPix)}</strong>
                    </div>
                  </div>
                )}

                <button type="button" className="btn btn--secondary" onClick={fecharModal}>
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </header>
  )
}

export default StatusHeader
