import { formatarMoeda } from '../utils/format'
import { formatarMesExtenso } from '../utils/meses'
import SeletorMes from './SeletorMes'
import './StatusHeader.css'

function StatusHeader({
  totalCofre,
  receitaMes,
  faturasCartao,
  faturasPagasTotal = 0,
  faturasPendentesTotal,
  qtdFaturasPagas = 0,
  qtdFaturasTotal = 0,
  todasFaturasPagas = false,
  despesasContaPix,
  saldoMes,
  statusMes,
  mesReferencia,
  aoMudarMes,
}) {
  const ehPositivo = (statusMes ?? (saldoMes >= 0 ? 'positivo' : 'negativo')) === 'positivo'
  const valorFaturasExibir = faturasPendentesTotal !== undefined ? faturasPendentesTotal : faturasCartao

  const indicadores = [
    { id: 'cofre', rotulo: 'Dinheiro no Cofre', valor: totalCofre, classe: '' },
    { id: 'receita', rotulo: 'Receita do Mês', valor: receitaMes, classe: 'positive' },
    {
      id: 'faturas',
      rotulo: todasFaturasPagas
        ? 'Faturas (Todas Pagas)'
        : faturasPagasTotal > 0
          ? 'Faturas a Pagar'
          : 'Faturas de Cartão',
      valor: valorFaturasExibir,
      sub: todasFaturasPagas
        ? `Todas as faturas do mês quitadas (${formatarMoeda(faturasPagasTotal)})`
        : faturasPagasTotal > 0
          ? `${qtdFaturasPagas}/${qtdFaturasTotal} pagas (${formatarMoeda(faturasPagasTotal)} quitados)`
          : qtdFaturasTotal > 0
            ? `${qtdFaturasTotal} fatura(s) a pagar`
            : null,
      classe: todasFaturasPagas ? 'positive' : 'negative',
    },
    { id: 'debito-pix', rotulo: 'Débito & PIX (Conta)', valor: despesasContaPix, classe: 'warning' },
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
        </div>
      </section>

      {/* Grid com 4 Indicadores */}
      <section className="status-header__grid" aria-label="Indicadores globais">
        {indicadores.map((item, i) => (
          <article
            key={item.id}
            id={`indicador-${item.id}`}
            className="card status-card fade-up"
            style={{ animationDelay: `${0.08 * (i + 1)}s` }}
          >
            <p className="card-subtitle">{item.rotulo}</p>
            <p className={`status-card__value ${item.classe}`}>{formatarMoeda(item.valor)}</p>
            {item.sub && <span className="status-card__sub">{item.sub}</span>}
          </article>
        ))}
      </section>
    </header>
  )
}

export default StatusHeader
