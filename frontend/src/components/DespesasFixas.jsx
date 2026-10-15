import { useState } from 'react'
import { formatarMoeda } from '../utils/format'
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

// Módulo de Despesas Fixas:
// - Checklist mensal inteligente (status Pago / Pendente por mês)
// - Separação clara entre contas do mês atual e contas agendadas para início futuro
// - Contas contínuas ou com prazo determinado (recorrência finita)
// - Resumo em tempo real do total, pago no mês e a pagar
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

  // Estado de edição de despesa fixa (valor e descrição)
  const [editandoId, setEditandoId] = useState(null)
  const [editDescricao, setEditDescricao] = useState('')
  const [editValor, setEditValor] = useState('')

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

  // Separar contas ativas do mês atual vs contas agendadas para começar em meses futuros
  const ehFutura = (t) => {
    const mesInicio = t.data_compra ? t.data_compra.slice(0, 7) : null
    return Boolean(mesInicio && mesInicio > mesAtualRef)
  }

  const despesasDoMes = fixas.filter((t) => !ehFutura(t))
  const despesasFuturas = fixas.filter(ehFutura)

  // Cálculos de resumo do mês (apenas contas do mês atual!)
  const ativas = despesasDoMes.filter((t) => t.ativa)
  const totalMensal = ativas.reduce((soma, t) => soma + t.valor, 0)
  const totalPago = ativas.filter((t) => t.pago).reduce((soma, t) => soma + t.valor, 0)
  const totalPendente = Math.max(totalMensal - totalPago, 0)
  const qtdPagas = ativas.filter((t) => t.pago).length
  const qtdTotal = ativas.length
  const progresso = totalMensal > 0 ? Math.min((totalPago / totalMensal) * 100, 100) : 0

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
        {/* Resumo do mês: Total, Pago e A Pagar */}
        <div className="fixas__resumo">
          <div className="fixas__resumo-cards">
            <div className="fixas__resumo-item">
              <span className="card-subtitle">Total Mensal ({formatarMesAno(mesAtualRef)})</span>
              <span className="fixas__resumo-valor negative">{formatarMoeda(totalMensal)}</span>
            </div>
            <div className="fixas__resumo-item">
              <span className="card-subtitle">Pago este Mês ({qtdPagas}/{qtdTotal})</span>
              <span className="fixas__resumo-valor positive">{formatarMoeda(totalPago)}</span>
            </div>
            <div className="fixas__resumo-item">
              <span className="card-subtitle">A Pagar</span>
              <span className="fixas__resumo-valor warning">{formatarMoeda(totalPendente)}</span>
            </div>
          </div>

          {/* Barra de progresso visual */}
          <div className="fixas__progresso-trilho" title={`${progresso.toFixed(0)}% pago`}>
            <div className="fixas__progresso-barra" style={{ width: `${progresso}%` }} />
          </div>
        </div>

        {/* Lista de Contas do Mês Atual */}
        {despesasDoMes.length === 0 ? (
          <p className="fixas__vazio">Nenhuma despesa fixa ativa para este mês.</p>
        ) : (
          <ul className="fixas__lista">
            {despesasDoMes.map((t) => {
              const ativa = t.ativa
              const ehTemporaria = t.total_parcelas > 1
              const emEdicao = editandoId === t.id

              return (
                <li
                  key={t.id}
                  className={`fixas__item ${ativa ? '' : 'fixas__item--pausada'} ${
                    t.pago ? 'fixas__item--pago' : ''
                  }`}
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
                          ✓ Salvar
                        </button>
                        <button
                          type="button"
                          className="fixas__btn-cancelar"
                          title="Cancelar edição"
                          onClick={cancelarEdicao}
                        >
                          ✕ Cancelar
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
                              title={`Despesa com prazo: parcela ${t.parcela_atual} de ${t.total_parcelas}`}
                            >
                              ⏱️ {t.parcela_atual}/{t.total_parcelas} meses
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

                      {/* Seletor de forma de pagamento na linha da despesa */}
                      <select
                        className="fixas__forma-select"
                        value={t.forma_pagamento || 'Crédito'}
                        onChange={(e) => aoAtualizar(t.id, { forma_pagamento: e.target.value })}
                        aria-label={`Forma de pagamento de ${t.descricao}`}
                        title="Forma de pagamento (altere quando quiser)"
                      >
                        <option value="PIX">⚡ PIX</option>
                        <option value="Débito">🏦 Débito/Conta</option>
                        <option value="Crédito">💳 Crédito</option>
                        <option value="Voucher">🍽️ Voucher</option>
                        <option value="Dinheiro">💵 Dinheiro</option>
                      </select>

                      <span className="fixas__valor">{formatarMoeda(t.valor)}</span>

                      <button
                        type="button"
                        className="fixas__btn-editar"
                        aria-label={`Editar ${t.descricao}`}
                        title="Editar valor e descrição"
                        onClick={() => iniciarEdicao(t)}
                      >
                        ✏️
                      </button>

                      {/* Botão de Status: Pago vs Pendente */}
                      <button
                        id={`pago-fixa-${t.id}`}
                        type="button"
                        className={`fixas__btn-status ${
                          t.pago ? 'fixas__btn-status--pago' : 'fixas__btn-status--pendente'
                        }`}
                        onClick={() => aoAlternarPagamento(t.id)}
                        title={t.pago ? 'Clique para marcar como Pendente' : 'Clique para marcar como Pago'}
                        aria-label={`${t.descricao}: ${t.pago ? 'Pago' : 'Pendente'}`}
                      >
                        {t.pago ? '✓ Pago' : '⏳ Pendente'}
                      </button>

                      {/* Interruptor ativar/pausar */}
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
                        ✕
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* Seção de Contas Agendadas para Início Futuro */}
        {despesasFuturas.length > 0 && (
          <div className="fixas__secao-futuras">
            <div className="fixas__futuras-cabecalho">
              <span className="fixas__badge-futuro">🗓️ Início Futuro ({despesasFuturas.length})</span>
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
                            ✓ Salvar
                          </button>
                          <button
                            type="button"
                            className="fixas__btn-cancelar"
                            title="Cancelar edição"
                            onClick={cancelarEdicao}
                          >
                            ✕ Cancelar
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
                              🗓️ Inicia em {formatarMesAno(mesInicio)}
                            </span>
                            {ehTemporaria && (
                              <span className="fixas__tag-prazo">
                                ⏱️ {t.total_parcelas} meses
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
                          <option value="PIX">⚡ PIX</option>
                          <option value="Débito">🏦 Débito</option>
                          <option value="Crédito">💳 Crédito</option>
                          <option value="Voucher">🍽️ Voucher</option>
                          <option value="Dinheiro">💵 Dinheiro</option>
                        </select>

                        <span className="fixas__valor">{formatarMoeda(t.valor)}</span>

                        <button
                          type="button"
                          className="fixas__btn-editar"
                          aria-label={`Editar ${t.descricao}`}
                          title="Editar valor e descrição"
                          onClick={() => iniciarEdicao(t)}
                        >
                          ✏️
                        </button>

                        <span
                          className="fixas__badge-status-agendado"
                          title="Esta conta só passará para a lista de pagamentos ativos no mês de início estipulado"
                        >
                          ⏳ Agendada
                        </span>

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
                          ✕
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
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
              title="Data de pagamento ou início (se for mês futuro, ficará agendada)"
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
              <option value="PIX">⚡ PIX / Transferência</option>
              <option value="Débito">🏦 Débito em Conta / PIX</option>
              <option value="Crédito">💳 Cartão de Crédito</option>
              <option value="Voucher">🍽️ Voucher (Vale Refeição)</option>
              <option value="Dinheiro">💵 Dinheiro</option>
            </select>
          </div>

          {/* Opção para despesa com prazo determinado */}
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
            {enviando ? 'Adicionando…' : '+ Adicionar'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default DespesasFixas
