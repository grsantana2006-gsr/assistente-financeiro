import { formatarMoeda } from '../utils/format'
import './StatusHeader.css'

// Recebe os 3 indicadores já calculados e só se preocupa em exibi-los.
// "props" são os dados que o componente pai (App) entrega para o filho.
function StatusHeader({ totalCofre, receitaMes, faturasAbertas }) {
  const indicadores = [
    { id: 'cofre', rotulo: 'Dinheiro no Cofre', valor: totalCofre, icone: '🏦', classe: '' },
    { id: 'receita', rotulo: 'Receita Líquida do Mês', valor: receitaMes, icone: '📈', classe: 'positive' },
    { id: 'faturas', rotulo: 'Faturas Abertas', valor: faturasAbertas, icone: '💳', classe: 'negative' },
  ]

  return (
    <header className="status-header">
      <div className="status-header__intro fade-up">
        <p className="status-header__eyebrow">Assistente Financeiro</p>
        <h1 className="status-header__title">
          Olá, Guilherme <span aria-hidden="true">👋</span>
        </h1>
        <p className="card-subtitle">Veja como estão suas finanças neste mês.</p>
      </div>

      <section className="status-header__grid" aria-label="Indicadores globais">
        {indicadores.map((item, i) => (
          <article
            key={item.id}
            id={`indicador-${item.id}`}
            className="card status-card fade-up"
            style={{ animationDelay: `${0.1 * (i + 1)}s` }}
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
