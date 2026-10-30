import { useState } from 'react'
import { formatarMoeda, formatarMesAnoCurto } from '../utils/format'
import { obterMesFatura, classificarDespesaFixa } from '../utils/calculos'
import './DespesasFixas.css'

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

function DespesasFixas({
  fixas = [],
  bancos = [],
  mesReferencia,
  aoAdicionar,
  aoAlternar,
  aoRemover,
  aoAtualizar,
  aoAlternarPagamento,
}) {
  const mesAtualRef = mesReferencia || new Date().toISOString().slice(0, 7)

  // Filtro rápido: todos | conta | credito
  const [filtroTipo, setFiltroTipo] = useState('todos')

  // Formulário controlado
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [bancoId, setBancoId] = useState(bancos[0]?.id ?? '')
  const [formaPagamento, setFormaPagamento] = useState('PIX')
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().split('T')[0])
  const [temPrazo, setTemPrazo] = useState(false)
  const [totalParcelas, setTotalParcelas] = useState('12')
  const [parcelaAtual, setParcelaAtual] = useState('1')
  const [enviando, setEnviando] = useState(false)
  const [mostrarEncerradas, setMostrarEncerradas] = useState(false)

  // Estado de edição de despesa fixa (valor e descrição)
  const [editandoId, setEditandoId] = useState(null)
  const [editDescricao, setEditDescricao] = useState('')
  const [editValor, setEditValor] = useState('')
  const [processandoId, setProcessandoId] = useState(null)

  async function tratarAlternarPagamento(id, mesAlvo) {
    if (processandoId) return
    setProcessandoId(id)
    try {
      if (aoAlternarPagamento) {
        await aoAlternarPagamento(id, mesAlvo)
      }
    } finally {
      setProcessandoId(null)
    }
  }

  function iniciarEdicao(t) {
    setEditandoId(t.id)
    setEditDescricao(t.descricao)
    setEditValor(String(t.valor).replace('.', ','))
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
      })
    }
    setEditandoId(null)
  }

  const despesasClassificadas = fixas.map((t) => {
    const info = classificarDespesaFixa(t, mesAtualRef, bancos)
    return {
      ...t,
      statusNoMes: info.status,
      parcelaNoMes: info.parcelaNoMes,
      totalParcelasNoMes: info.totalParcelas,
      mesInicioCalculado: info.mesInicio,
    }
  })

  const despesasDoMes = despesasClassificadas.filter((t) => t.statusNoMes === 'ativa')
  const despesasFuturas = despesasClassificadas.filter((t) => t.statusNoMes === 'futura')
  const despesasEncerradas = despesasClassificadas.filter((t) => t.statusNoMes === 'encerrada')

  const despesasFiltradas = despesasDoMes.filter((t) => {
    if (filtroTipo === 'conta') return t.forma_pagamento !== 'Crédito'
    if (filtroTipo === 'credito') return t.forma_pagamento === 'Crédito'
    return true
  })

  const ativas = despesasDoMes.filter((t) => t.ativa)
  const totalMensal = ativas.reduce((soma, t) => soma + t.valor, 0)

  const contasContaPix = ativas.filter((t) => t.forma_pagamento !== 'Crédito')
  const contasCredito = ativas.filter((t) => t.forma_pagamento === 'Crédito')

  const liquidadoConta = contasContaPix
    .filter((t) => t.pago)
    .reduce((soma, t) => soma + t.valor, 0)
  const qtdLiquidadaConta = contasContaPix.filter((t) => t.pago).length
  const qtdTotalConta = contasContaPix.length

  const lancadoFatura = contasCredito
    .filter((t) => t.pago)
    .reduce((soma, t) => soma + t.valor, 0)
  const qtdLancadaFatura = contasCredito.filter((t) => t.pago).length
  const qtdTotalCredito = contasCredito.length

  const totalConfirmado = liquidadoConta + lancadoFatura
  const totalPendente = Math.max(totalMensal - totalConfirmado, 0)
  const qtdPendentes = ativas.filter((t) => !t.pago).length
  const qtdTotal = ativas.length
  const progresso = totalMensal > 0 ? Math.min((totalConfirmado / totalMensal) * 100, 100) : 0

  function nomeDoBanco(id) {
    return bancos.find((b) => b.id === id)?.nome ?? '—'
  }

  function aoMudarForma(novaForma) {
    setFormaPagamento(novaForma)
    if (novaForma === 'Voucher') {
      const bancoBeneficio = bancos.find((b) => b.tipo === 'Benefício')
      if (bancoBeneficio) setBancoId(bancoBeneficio.id)
    }
  }

  async function enviar(evento) {
    evento.preventDefault()
    const valorNumerico = Number(valor.replace(',', '.'))
    if (!descricao.trim() || Number.isNaN(valorNumerico) || valorNumerico <= 0) return

    setEnviando(true)
    const dados = {
      descricao: descricao.trim(),
      valor: valorNumerico,
      banco_id: Number(bancoId || bancos[0]?.id),
      forma_pagamento: formaPagamento,
      data_compra: dataCompra || undefined,
      total_parcelas: temPrazo && Number(totalParcelas) > 1 ? Number(totalParcelas) : 1,
      parcela_atual: temPrazo && Number(parcelaAtual) >= 1 ? Number(parcelaAtual) : 1,
    }

    const deuCerto = await aoAdicionar(dados)
    setEnviando(false)

    if (deuCerto) {
      setDescricao('')
      setValor('')
      setFormaPagamento('PIX')
      setTemPrazo(false)
      setTotalParcelas('12')
      setParcelaAtual('1')
    }
  }

  return (
    <section id="despesas-fixas" aria-labelledby="titulo-fixas">
      <div className="secao__cabecalho">
        <h2 id="titulo-fixas">Despesas Fixas</h2>
        <p className="card-subtitle">
          Checklist de contas recorrentes do mês com status de pagamento e previsão.
        </p>
      </div>

      <div className="card fixas">
        {/* Resumo do mês */}
        <div className="fixas__resumo">
          <div className="fixas__resumo-cards">
            <div className="fixas__resumo-item">
              <span className="card-subtitle">Total Mensal ({formatarMesAno(mesAtualRef)})</span>
              <span className="fixas__resumo-valor negative">{formatarMoeda(totalMensal)}</span>
              <span className="fixas__resumo-sub">{qtdTotal} contas ativas</span>
            </div>
            <div className="fixas__resumo-item">
              <span className="card-subtitle">Liquidado na Conta</span>
              <span className="fixas__resumo-valor positive">{formatarMoeda(liquidadoConta)}</span>
              <span className="fixas__resumo-sub">
                {qtdLiquidadaConta}/{qtdTotalConta} via PIX/Débito
              </span>
            </div>
            <div className="fixas__resumo-item">
              <span className="card-subtitle">Lançado nas Faturas</span>
              <span className="fixas__resumo-valor credit">{formatarMoeda(lancadoFatura)}</span>
              <span className="fixas__resumo-sub">
                {qtdLancadaFatura}/{qtdTotalCredito} assinaturas cartão
              </span>
            </div>
            <div className="fixas__resumo-item">
              <span className="card-subtitle">Ainda Pendente</span>
              <span className="fixas__resumo-valor warning">{formatarMoeda(totalPendente)}</span>
              <span className="fixas__resumo-sub">{qtdPendentes} a confirmar</span>
            </div>
          </div>

          <div
            className="fixas__progresso-trilho"
            title={`${progresso.toFixed(0)}% processado (${formatarMoeda(totalConfirmado)} de ${formatarMoeda(totalMensal)})`}
          >
            <div className="fixas__progresso-barra" style={{ width: `${progresso}%` }} />
          </div>
        </div>

        {/* Filtro Rápido */}
        <div className="fixas__filtros" role="group" aria-label="Filtrar despesas fixas">
          <button
            type="button"
            className={`fixas__filtro-btn ${filtroTipo === 'todos' ? 'fixas__filtro-btn--ativo' : ''}`}
            onClick={() => setFiltroTipo('todos')}
          >
            Todas ({despesasDoMes.length})
          </button>
          <button
            type="button"
            className={`fixas__filtro-btn ${filtroTipo === 'conta' ? 'fixas__filtro-btn--ativo' : ''}`}
            onClick={() => setFiltroTipo('conta')}
          >
            Conta / PIX ({contasContaPix.length})
          </button>
          <button
            type="button"
            className={`fixas__filtro-btn ${filtroTipo === 'credito' ? 'fixas__filtro-btn--ativo' : ''}`}
            onClick={() => setFiltroTipo('credito')}
          >
            Cartão ({contasCredito.length})
          </button>
        </div>

        {/* Lista de Contas do Mês Atual */}
        {despesasFiltradas.length === 0 ? (
          <p className="fixas__vazio">Nenhuma despesa fixa encontrada com o filtro selecionado.</p>
        ) : (
          <ul className="fixas__lista">
            {despesasFiltradas.map((t) => {
              const ativa = t.ativa
              const ehTemporaria = t.total_parcelas > 1
              const emEdicao = editandoId === t.id
              const ehCredito = t.forma_pagamento === 'Crédito'

              const statusClass = t.pago
                ? ehCredito
                  ? 'fixas__btn-status--fatura'
                  : 'fixas__btn-status--pago'
                : ehCredito
                  ? 'fixas__btn-status--a-cobrar'
                  : 'fixas__btn-status--pendente'

              const statusTexto = t.pago
                ? ehCredito
                  ? 'Na Fatura'
                  : 'Liquidado'
                : ehCredito
                  ? 'A Cobrar'
                  : 'Pendente'

              const banco = bancos.find((b) => b.id === t.banco_id)
              const diaCobranca = t.data_compra ? Number(t.data_compra.slice(8, 10)) : null
              const hoje = new Date()
              const hojeDia = hoje.getDate()
              const mesRealAtual = hoje.toISOString().slice(0, 7)
              const cobrancaPassou =
                !t.pago &&
                Boolean(diaCobranca) &&
                (mesAtualRef < mesRealAtual || (mesAtualRef === mesRealAtual && hojeDia > diaCobranca))

              const statusTitle = t.pago
                ? ehCredito
                  ? 'Confirmado na fatura deste mês. Clique para desmarcar.'
                  : 'Liquidado na conta neste mês. Clique para desmarcar.'
                : ehCredito
                  ? 'Ainda não confirmado na fatura. Clique para confirmar lançamento.'
                  : 'Pendente de pagamento na conta. Clique para marcar como liquidado.'

              return (
                <li
                  key={t.id}
                  className={`fixas__item ${ativa ? '' : 'fixas__item--pausada'}`}
                >
                  {emEdicao ? (
                    <div className="fixas__edicao-inline">
                      <input
                        type="text"
                        className="fixas__edit-input fixas__edit-input--desc"
                        value={editDescricao}
                        onChange={(e) => setEditDescricao(e.target.value)}
                        placeholder="Descrição"
                        aria-label="Descrição da conta fixa"
                      />
                      <input
                        type="text"
                        className="fixas__edit-input fixas__edit-input--valor"
                        value={editValor}
                        onChange={(e) => setEditValor(e.target.value)}
                        placeholder="Valor R$"
                        aria-label="Valor da conta fixa"
                      />
                      <div className="fixas__edit-acoes">
                        <button
                          type="button"
                          className="fixas__btn-salvar"
                          title="Salvar alterações"
                          onClick={() => salvarEdicao(t.id)}
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
                        <div className="fixas__nome-linha">
                          <span className="fixas__nome">{t.descricao}</span>
                          {ehTemporaria && (
                            <span
                              className="fixas__tag-prazo"
                              title={`Despesa com prazo: parcela ${t.parcelaNoMes} de ${t.total_parcelas}`}
                            >
                              {t.parcelaNoMes}/{t.total_parcelas} meses
                            </span>
                          )}
                          {ehCredito && (
                            <span
                              className="fixas__tag-fatura"
                              title={`Assinatura cobrada dia ${diaCobranca || ''}: entra na fatura que vence em ${formatarMesAnoCurto(mesAtualRef)}`}
                            >
                              Fatura {formatarMesAnoCurto(mesAtualRef)}
                            </span>
                          )}
                          {cobrancaPassou && (
                            <span
                              className="fixas__tag-alerta-data"
                              title={`A data prevista de cobrança (dia ${diaCobranca}) já passou e esta conta continua pendente neste mês.`}
                            >
                              Passou do dia {diaCobranca}
                            </span>
                          )}
                        </div>
                        <span className="card-subtitle">{nomeDoBanco(t.banco_id)}</span>
                      </div>

                      <input
                        type="date"
                        className="fixas__data-edit"
                        value={t.data_compra || ''}
                        onChange={(e) => aoAtualizar(t.id, { data_compra: e.target.value })}
                        aria-label={`Data de ${t.descricao}`}
                        title="Data de cobrança/início"
                      />

                      <select
                        className="fixas__forma-select"
                        value={t.forma_pagamento || 'Crédito'}
                        onChange={(e) => aoAtualizar(t.id, { forma_pagamento: e.target.value })}
                        aria-label={`Forma de pagamento de ${t.descricao}`}
                        title="Forma de pagamento"
                      >
                        <option value="PIX">PIX</option>
                        <option value="Débito">Débito/Conta</option>
                        <option value="Crédito">Crédito</option>
                        <option value="Voucher">Voucher</option>
                        <option value="Dinheiro">Dinheiro</option>
                      </select>

                      <span className="fixas__valor">{formatarMoeda(t.valor)}</span>

                      <button
                        type="button"
                        className="fixas__btn-editar"
                        aria-label={`Editar ${t.descricao}`}
                        title="Editar valor e descrição"
                        onClick={() => iniciarEdicao(t)}
                      >
                        Editar
                      </button>

                      <button
                        id={`pago-fixa-${t.id}`}
                        type="button"
                        disabled={processandoId === t.id}
                        className={`fixas__btn-status ${statusClass} ${processandoId === t.id ? 'fixas__btn-status--carregando' : ''}`}
                        onClick={() => tratarAlternarPagamento(t.id, mesAtualRef)}
                        title={statusTitle}
                        aria-label={`${t.descricao}: ${statusTexto}`}
                      >
                        {processandoId === t.id ? 'Salvando…' : statusTexto}
                      </button>

                      <button
                        id={`alternar-fixa-${t.id}`}
                        type="button"
                        role="switch"
                        aria-checked={ativa}
                        aria-label={`${ativa ? 'Pausar' : 'Ativar'} ${t.descricao}`}
                        className={`interruptor ${ativa ? 'interruptor--ligado' : ''}`}
                        onClick={() => aoAlternar(t)}
                        title={ativa ? 'Pausar conta' : 'Ativar conta'}
                      />

                      <button
                        id={`remover-fixa-${t.id}`}
                        type="button"
                        className="fixas__remover"
                        aria-label={`Remover ${t.descricao}`}
                        onClick={() => aoRemover(t.id)}
                        title="Remover conta"
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

        {/* Contas de Início Futuro */}
        {despesasFuturas.length > 0 && (
          <div className="fixas__secao-futuras">
            <div className="fixas__futuras-cabecalho">
              <span className="fixas__badge-futuro">Início Futuro ({despesasFuturas.length})</span>
              <p className="card-subtitle">
                Contas agendadas para começar nos próximos meses. Não impactam os gastos nem o total do mês atual ({formatarMesAno(mesAtualRef)}).
              </p>
            </div>
            <ul className="fixas__lista fixas__lista--futuras">
              {despesasFuturas.map((t) => {
                const ativa = t.ativa
                const ehTemporaria = t.total_parcelas > 1
                const mesInicio = t.data_compra ? t.data_compra.slice(0, 7) : ''
                const emEdicao = editandoId === t.id

                return (
                  <li
                    key={t.id}
                    className={`fixas__item fixas__item--futuro ${ativa ? '' : 'fixas__item--pausada'}`}
                  >
                    {emEdicao ? (
                      <div className="fixas__edicao-inline">
                        <input
                          type="text"
                          className="fixas__edit-input fixas__edit-input--desc"
                          value={editDescricao}
                          onChange={(e) => setEditDescricao(e.target.value)}
                          placeholder="Descrição"
                          aria-label="Descrição da conta fixa"
                        />
                        <input
                          type="text"
                          className="fixas__edit-input fixas__edit-input--valor"
                          value={editValor}
                          onChange={(e) => setEditValor(e.target.value)}
                          placeholder="Valor R$"
                          aria-label="Valor da conta fixa"
                        />
                        <div className="fixas__edit-acoes">
                          <button
                            type="button"
                            className="fixas__btn-salvar"
                            title="Salvar alterações"
                            onClick={() => salvarEdicao(t.id)}
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
                          <div className="fixas__nome-linha">
                            <span className="fixas__nome">{t.descricao}</span>
                            <span
                              className="fixas__tag-agendada"
                              title={`Esta conta começará a ser cobrada a partir de ${formatarMesAno(mesInicio)}`}
                            >
                              Inicia em {formatarMesAno(mesInicio)}
                            </span>
                            {ehTemporaria && (
                              <span className="fixas__tag-prazo">
                                {t.total_parcelas} meses
                              </span>
                            )}
                          </div>
                          <span className="card-subtitle">{nomeDoBanco(t.banco_id)}</span>
                        </div>

                        <input
                          type="date"
                          className="fixas__data-edit"
                          value={t.data_compra || ''}
                          onChange={(e) => aoAtualizar(t.id, { data_compra: e.target.value })}
                          aria-label={`Data de início de ${t.descricao}`}
                          title="Data de início da cobrança"
                        />

                        <select
                          className="fixas__forma-select"
                          value={t.forma_pagamento || 'Crédito'}
                          onChange={(e) => aoAtualizar(t.id, { forma_pagamento: e.target.value })}
                          aria-label={`Forma de pagamento de ${t.descricao}`}
                        >
                          <option value="PIX">PIX</option>
                          <option value="Débito">Débito</option>
                          <option value="Crédito">Crédito</option>
                          <option value="Voucher">Voucher</option>
                          <option value="Dinheiro">Dinheiro</option>
                        </select>

                        <span className="fixas__valor">{formatarMoeda(t.valor)}</span>

                        <button
                          type="button"
                          className="fixas__btn-editar"
                          aria-label={`Editar ${t.descricao}`}
                          title="Editar valor e descrição"
                          onClick={() => iniciarEdicao(t)}
                        >
                          Editar
                        </button>

                        <button
                          id={`pago-fixa-${t.id}`}
                          type="button"
                          disabled={processandoId === t.id}
                          className={`fixas__btn-status ${
                            t.pago
                              ? (t.forma_pagamento === 'Crédito' ? 'fixas__btn-status--fatura' : 'fixas__btn-status--pago')
                              : 'fixas__btn-status--a-cobrar'
                          } ${processandoId === t.id ? 'fixas__btn-status--carregando' : ''}`}
                          onClick={() => tratarAlternarPagamento(t.id, mesInicio)}
                          title={
                            t.pago
                              ? (t.forma_pagamento === 'Crédito'
                                  ? `Lançado na fatura de ${formatarMesAnoCurto(mesInicio)}. Clique para desmarcar.`
                                  : `Liquidado em ${formatarMesAnoCurto(mesInicio)}. Clique para desmarcar.`)
                              : (t.forma_pagamento === 'Crédito'
                                  ? `Agendado para ${formatarMesAnoCurto(mesInicio)}. Clique para confirmar lançamento agora.`
                                  : `Agendado para ${formatarMesAnoCurto(mesInicio)}. Clique para marcar como liquidado agora.`)
                          }
                          aria-label={`${t.descricao}: ${t.pago ? 'Confirmado' : 'Agendada'}`}
                        >
                          {processandoId === t.id
                            ? 'Salvando…'
                            : (t.pago ? (t.forma_pagamento === 'Crédito' ? 'Na Fatura' : 'Liquidado') : 'Agendada')}
                        </button>

                        <button
                          id={`alternar-fixa-${t.id}`}
                          type="button"
                          role="switch"
                          aria-checked={ativa}
                          aria-label={`${ativa ? 'Pausar' : 'Ativar'} ${t.descricao}`}
                          className={`interruptor ${ativa ? 'interruptor--ligado' : ''}`}
                          onClick={() => aoAlternar(t)}
                          title={ativa ? 'Pausar agendamento' : 'Ativar agendamento'}
                        />

                        <button
                          id={`remover-fixa-${t.id}`}
                          type="button"
                          className="fixas__remover"
                          aria-label={`Remover ${t.descricao}`}
                          onClick={() => aoRemover(t.id)}
                          title="Remover conta"
                        >
                          Excluir
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Contas Encerradas / Concluídas */}
        {despesasEncerradas.length > 0 && (
          <div className="fixas__secao-encerradas">
            <div className="fixas__encerradas-cabecalho">
              <div>
                <span className="fixas__badge-encerrada">Encerradas / Concluídas ({despesasEncerradas.length})</span>
                <p className="card-subtitle">
                  Contas com prazo determinado que já foram quitadas antes de {formatarMesAno(mesAtualRef)}. Não pesam mais no seu orçamento.
                </p>
              </div>
              <button
                type="button"
                className="fixas__btn-toggle-encerradas"
                onClick={() => setMostrarEncerradas((prev) => !prev)}
              >
                {mostrarEncerradas ? 'Ocultar contas encerradas' : 'Ver contas encerradas'}
              </button>
            </div>
            {mostrarEncerradas && (
              <ul className="fixas__lista fixas__lista--encerradas">
                {despesasEncerradas.map((t) => (
                  <li key={t.id} className="fixas__item fixas__item--encerrada">
                    <div className="fixas__info">
                      <div className="fixas__nome-linha">
                        <span className="fixas__nome">{t.descricao}</span>
                        <span className="fixas__tag-encerrada">
                          Concluída ({t.total_parcelas} meses)
                        </span>
                      </div>
                      <span className="card-subtitle">
                        {nomeDoBanco(t.banco_id)} &bull; {t.forma_pagamento}
                      </span>
                    </div>
                    <span className="fixas__valor" style={{ opacity: 0.6 }}>
                      {formatarMoeda(t.valor)}
                    </span>
                    <button
                      type="button"
                      className="fixas__remover"
                      aria-label={`Remover ${t.descricao}`}
                      onClick={() => aoRemover(t.id)}
                      title="Remover conta do histórico"
                    >
                      Excluir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Formulário de adicionar nova despesa fixa */}
        <form className="fixas__form" onSubmit={enviar}>
          <div className="fixas__form-campos">
            <input
              id="fixa-descricao"
              type="text"
              placeholder="Ex.: Curso de Programação"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              aria-label="Descrição da despesa fixa"
            />
            <input
              id="fixa-valor"
              type="text"
              inputMode="decimal"
              placeholder="Valor (R$)"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              aria-label="Valor da despesa fixa"
            />
            <input
              id="fixa-data"
              type="date"
              value={dataCompra}
              onChange={(e) => setDataCompra(e.target.value)}
              aria-label="Data de início ou pagamento"
              title="Data de pagamento ou início"
            />
            <select
              id="fixa-banco"
              value={bancoId}
              onChange={(e) => setBancoId(e.target.value)}
              aria-label="Banco da despesa fixa"
            >
              {bancos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
            <select
              id="fixa-forma"
              value={formaPagamento}
              onChange={(e) => aoMudarForma(e.target.value)}
              aria-label="Forma de pagamento da despesa fixa"
            >
              <option value="PIX">PIX / Transferência</option>
              <option value="Débito">Débito em Conta / PIX</option>
              <option value="Crédito">Cartão de Crédito</option>
              <option value="Voucher">Voucher (Vale Refeição)</option>
              <option value="Dinheiro">Dinheiro</option>
            </select>
          </div>

          <div className="fixas__form-duracao">
            <label className="fixas__checkbox-rotulo">
              <input
                id="fixa-tem-prazo"
                type="checkbox"
                checked={temPrazo}
                onChange={(e) => setTemPrazo(e.target.checked)}
              />
              <span>Tem duração / prazo determinado (ex: curso de 12 meses, seguro em 10x)</span>
            </label>

            {temPrazo && (
              <div className="fixas__duracao-inputs">
                <label className="fixas__duracao-campo">
                  <span>Total de meses:</span>
                  <input
                    id="fixa-total-meses"
                    type="number"
                    min="2"
                    max="120"
                    placeholder="12"
                    value={totalParcelas}
                    onChange={(e) => setTotalParcelas(e.target.value)}
                  />
                </label>
                <label className="fixas__duracao-campo">
                  <span>Mês / parcela atual:</span>
                  <input
                    id="fixa-mes-atual"
                    type="number"
                    min="1"
                    max={totalParcelas || 120}
                    placeholder="1"
                    value={parcelaAtual}
                    onChange={(e) => setParcelaAtual(e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>

          <button id="fixa-adicionar" type="submit" className="btn btn--primary" disabled={enviando}>
            {enviando ? 'Adicionando…' : 'Adicionar'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default DespesasFixas
