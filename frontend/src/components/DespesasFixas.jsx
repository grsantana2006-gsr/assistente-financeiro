import { useState } from 'react'
import { formatarMoeda } from '../utils/format'
import './DespesasFixas.css'

// Módulo de Despesas Fixas:
// - Checklist mensal inteligente (status Pago / Pendente por mês)
// - Contas contínuas ou com prazo determinado (recorrência finita)
// - Resumo em tempo real do total, pago no mês e a pagar
function DespesasFixas({
  fixas,
  bancos,
  aoAdicionar,
  aoAlternar,
  aoRemover,
  aoAtualizar,
  aoAlternarPagamento,
}) {
  // Formulário controlado
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [bancoId, setBancoId] = useState(bancos[0]?.id ?? '')
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().split('T')[0])
  const [temPrazo, setTemPrazo] = useState(false)
  const [totalParcelas, setTotalParcelas] = useState('12')
  const [parcelaAtual, setParcelaAtual] = useState('1')
  const [enviando, setEnviando] = useState(false)

  // Cálculos de resumo do mês
  const ativas = fixas.filter((t) => t.ativa)
  const totalMensal = ativas.reduce((soma, t) => soma + t.valor, 0)
  const totalPago = ativas.filter((t) => t.pago).reduce((soma, t) => soma + t.valor, 0)
  const totalPendente = Math.max(totalMensal - totalPago, 0)
  const qtdPagas = ativas.filter((t) => t.pago).length
  const qtdTotal = ativas.length
  const progresso = totalMensal > 0 ? Math.min((totalPago / totalMensal) * 100, 100) : 0

  function nomeDoBanco(id) {
    return bancos.find((b) => b.id === id)?.nome ?? '—'
  }

  async function enviar(evento) {
    evento.preventDefault()
    const valorNumerico = Number(valor.replace(',', '.'))
    if (!descricao.trim() || Number.isNaN(valorNumerico) || valorNumerico <= 0) return

    setEnviando(true)
    const dados = {
      descricao: descricao.trim(),
      valor: valorNumerico,
      banco_id: Number(bancoId),
      data_compra: dataCompra || undefined,
      total_parcelas: temPrazo && Number(totalParcelas) > 1 ? Number(totalParcelas) : 1,
      parcela_atual: temPrazo && Number(parcelaAtual) >= 1 ? Number(parcelaAtual) : 1,
    }

    const deuCerto = await aoAdicionar(dados)
    setEnviando(false)

    if (deuCerto) {
      setDescricao('')
      setValor('')
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
              <span className="card-subtitle">Total Mensal</span>
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

        {fixas.length === 0 ? (
          <p className="fixas__vazio">Nenhuma despesa fixa cadastrada ainda.</p>
        ) : (
          <ul className="fixas__lista">
            {fixas.map((t) => {
              const ativa = t.ativa
              const ehTemporaria = t.total_parcelas > 1

              return (
                <li
                  key={t.id}
                  className={`fixas__item ${ativa ? '' : 'fixas__item--pausada'} ${
                    t.pago ? 'fixas__item--pago' : ''
                  }`}
                >
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
                  />

                  <span className="fixas__valor">{formatarMoeda(t.valor)}</span>

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
                </li>
              )
            })}
          </ul>
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
              aria-label="Data de pagamento"
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
