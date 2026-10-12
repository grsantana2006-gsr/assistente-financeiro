import { formatarMoeda } from '../utils/format'
import './StatusHeader.css'

// StatusHeader:
// - Banner executivo de veredito: Mostra na hora se você está no AZUL (lucro) ou no VERMELHO (prejuízo)
// - 4 Indicadores chave: Dinheiro no Cofre, Receita Líquida, Faturas de Cartão, Débito & PIX
function StatusHeader({
  totalCofre,
  receitaMes,
  faturasCartao,
  despesasContaPix,
  saldoMes,
  statusMes,
}) {
  const ehPositivo = (statusMes ?? (saldoMes >= 0 ? 'positivo' : 'negativo')) === 'positivo'

  const indicadores = [
    { id: 'cofre', rotulo: 'Dinheiro no Cofre', valor: totalCofre, icone: '🏦', classe: '' },
    { id: 'receita', rotulo: 'Receita do Mês', valor: receitaMes, icone: '📈', classe: 'positive' },
    { id: 'faturas', rotulo: 'Faturas de Cartão', valor: faturasCartao, icone: '💳', classe: 'warning' },
    { id: 'debito-pix', rotulo: 'Débito & PIX (Conta)', valor: despesasContaPix, icone: '⚡', classe: 'negative' },
  ]

  return (
    <header className="status-header">
      <div className="status-header__intro fade-up">
        <p className="status-header__eyebrow">Assistente Financeiro</p>
        <h1 className="status-header__title">
          Olá, Guilherme <span aria-hidden="true">👋</span>
        </h1>
        <p className="card-subtitle">Veja como está sua saúde financeira neste mês.</p>
      </div>

      {/* Banner de Veredito (No Azul vs No Vermelho) */}
      <section
        id="status-veredito"
        className={`status-banner ${ehPositivo ? 'status-banner--positivo' : 'status-banner--negativo'} fade-up`}
        aria-label="Veredito financeiro do mês"
      >
        <div className="status-banner__icone" aria-hidden="true">
          {ehPositivo ? '🟢' : '🔴'}
        </div>
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
            <span className="status-card__icon" aria-hidden="true">{item.icone}</span>
            <p className="card-subtitle">{item.rotulo}</p>
            <p className={`status-card__value ${item.classe}`}>{formatarMoeda(item.valor)}</p>
          </article>
        ))}
      </section>
    </header>
  )
}

export default StatusHeader
