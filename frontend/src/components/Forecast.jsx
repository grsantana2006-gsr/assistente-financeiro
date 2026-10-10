import { useState } from 'react'
import { formatarMoeda, formatarPercentual } from '../utils/format'
import './Forecast.css'

// Medidas do gráfico SVG. O "viewBox" faz o desenho escalar para qualquer tela.
const LARGURA = 760
const ALTURA = 300
const MARGEM = { esquerda: 56, direita: 16, topo: 16, base: 36 }

// 1500 -> "1,5k" (rótulos curtos para o eixo Y)
function moedaCompacta(valor) {
  if (valor >= 1000) return `${(valor / 1000).toFixed(1).replace('.', ',')}k`
  return String(Math.round(valor))
}

// A projeção (12 meses) já vem calculada pelo servidor; aqui só desenhamos.
function Forecast({ projecao }) {
  // Estados da tela: quantos meses mostrar e qual mês está em destaque
  const [horizonte, setHorizonte] = useState(6)
  const [selecionado, setSelecionado] = useState(1) // 1 = próximo mês

  const meses = projecao.slice(0, horizonte)
  const mesAtivo = meses[Math.min(selecionado, meses.length - 1)]
  const proximoMes = meses[1]

  // ---------- Matemática do gráfico ----------
  const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.base
  const larguraFaixa = larguraUtil / meses.length // espaço de cada mês
  const larguraBarra = larguraFaixa * 0.55

  // Valor máximo do eixo Y: o maior entre a renda e o maior comprometido (+10% de folga)
  const maximo = Math.max(...meses.map((m) => Math.max(m.renda, m.comprometido))) * 1.1 || 1

  // Converte um valor em R$ para a posição vertical (Y) no desenho
  const y = (valor) => MARGEM.topo + alturaUtil - (valor / maximo) * alturaUtil
  const altura = (valor) => (valor / maximo) * alturaUtil

  const linhasDeGrade = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maximo)
  const yRenda = y(meses[0].renda)

  // Cor/mensagem conforme o quanto da renda está comprometido
  const nivel = proximoMes.percentual >= 0.7 ? 'danger' : proximoMes.percentual >= 0.4 ? 'warning' : 'ok'

  return (
    <section id="forecast" aria-labelledby="titulo-forecast">
      <div className="secao__cabecalho">
        <h2 id="titulo-forecast">Forecast: previsibilidade financeira</h2>
        <p className="card-subtitle">
          Quanto da sua renda futura já está comprometida com contas fixas e parcelas?
        </p>
      </div>

      <div className="card forecast">
        {/* Destaque: responde a pergunta principal do README */}
        <div className={`forecast__destaque forecast__destaque--${nivel}`}>
          <p className="forecast__percentual">{formatarPercentual(proximoMes.percentual)}</p>
          <p>
            da sua renda de <strong>{proximoMes.rotuloCompleto}</strong> já está comprometida
            ({formatarMoeda(proximoMes.comprometido)} de {formatarMoeda(proximoMes.renda)}).
          </p>
        </div>

        {/* Seletor 6 / 12 meses */}
        <div className="forecast__controles" role="group" aria-label="Período da projeção">
          {[6, 12].map((n) => (
            <button
              key={n}
              id={`forecast-${n}-meses`}
              type="button"
              className={`btn ${horizonte === n ? 'btn--primary' : ''}`}
              aria-pressed={horizonte === n}
              onClick={() => setHorizonte(n)}
            >
              {n} meses
            </button>
          ))}
        </div>

        {/* ---------- Gráfico de barras empilhadas ---------- */}
        <svg
          className="forecast__grafico"
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          role="img"
          aria-label="Gráfico de despesas comprometidas por mês comparadas à renda"
        >
          <defs>
            <linearGradient id="grad-fixas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            <linearGradient id="grad-parcelas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>

          {/* Linhas de grade e rótulos do eixo Y */}
          {linhasDeGrade.map((valor) => (
            <g key={valor}>
              <line
                x1={MARGEM.esquerda}
                x2={LARGURA - MARGEM.direita}
                y1={y(valor)}
                y2={y(valor)}
                className="forecast__grade"
              />
              <text x={MARGEM.esquerda - 8} y={y(valor) + 4} className="forecast__eixo" textAnchor="end">
                {moedaCompacta(valor)}
              </text>
            </g>
          ))}

          {/* Uma coluna por mês */}
          {meses.map((m, i) => {
            const x = MARGEM.esquerda + i * larguraFaixa + (larguraFaixa - larguraBarra) / 2
            const ehAtivo = m.indice === mesAtivo.indice
            return (
              <g key={m.indice} className={ehAtivo ? 'forecast__coluna forecast__coluna--ativa' : 'forecast__coluna'}>
                {/* Parte de baixo: despesas fixas */}
                <rect
                  className="forecast__barra"
                  style={{ animationDelay: `${i * 0.05}s` }}
                  x={x}
                  y={y(m.fixas)}
                  width={larguraBarra}
                  height={altura(m.fixas)}
                  rx="3"
                  fill="url(#grad-fixas)"
                />
                {/* Parte de cima: parcelas, empilhadas sobre as fixas */}
                {m.parcelas > 0 && (
                  <rect
                    className="forecast__barra"
                    style={{ animationDelay: `${i * 0.05 + 0.1}s` }}
                    x={x}
                    y={y(m.fixas + m.parcelas)}
                    width={larguraBarra}
                    height={altura(m.parcelas)}
                    rx="3"
                    fill="url(#grad-parcelas)"
                  />
                )}
                <text
                  x={x + larguraBarra / 2}
                  y={ALTURA - 12}
                  textAnchor="middle"
                  className="forecast__rotulo"
                >
                  {m.rotulo}
                </text>
                {/* Área invisível maior, para facilitar passar o mouse/tocar */}
                <rect
                  id={`forecast-mes-${m.indice}`}
                  x={MARGEM.esquerda + i * larguraFaixa}
                  y={MARGEM.topo}
                  width={larguraFaixa}
                  height={alturaUtil + MARGEM.base}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalhes de ${m.rotuloCompleto}`}
                  onMouseEnter={() => setSelecionado(m.indice)}
                  onFocus={() => setSelecionado(m.indice)}
                  onClick={() => setSelecionado(m.indice)}
                />
              </g>
            )
          })}

          {/* Linha tracejada: sua renda mensal */}
          <line
            x1={MARGEM.esquerda}
            x2={LARGURA - MARGEM.direita}
            y1={yRenda}
            y2={yRenda}
            className="forecast__renda"
          />
          <text x={LARGURA - MARGEM.direita} y={yRenda - 6} textAnchor="end" className="forecast__renda-texto">
            Renda {formatarMoeda(meses[0].renda)}
          </text>
        </svg>

        {/* Legenda */}
        <ul className="forecast__legenda">
          <li><span className="forecast__cor forecast__cor--fixas" /> Despesas fixas</li>
          <li><span className="forecast__cor forecast__cor--parcelas" /> Parcelas</li>
          <li><span className="forecast__cor forecast__cor--renda" /> Renda mensal</li>
        </ul>

        {/* ---------- Detalhe do mês selecionado ---------- */}
        <div className="forecast__detalhe" aria-live="polite">
          <h3>{mesAtivo.rotuloCompleto}</h3>
          <dl className="forecast__numeros">
            <div>
              <dt>Fixas</dt>
              <dd>{formatarMoeda(mesAtivo.fixas)}</dd>
            </div>
            <div>
              <dt>Parcelas</dt>
              <dd>{formatarMoeda(mesAtivo.parcelas)}</dd>
            </div>
            <div>
              <dt>Comprometido</dt>
              <dd>{formatarPercentual(mesAtivo.percentual)}</dd>
            </div>
            <div>
              <dt>Saldo projetado</dt>
              <dd className={mesAtivo.saldo >= 0 ? 'positive' : 'negative'}>
                {formatarMoeda(mesAtivo.saldo)}
              </dd>
            </div>
          </dl>

          {mesAtivo.detalhesParcelas.length > 0 ? (
            <ul className="forecast__parcelas">
              {mesAtivo.detalhesParcelas.map((p) => (
                <li key={p.descricao}>
                  <span>{p.descricao} <small>({p.numero}/{p.total})</small></span>
                  <span>{formatarMoeda(p.valor)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="card-subtitle">Nenhuma parcela neste mês. 🎉</p>
          )}
        </div>

        <p className="forecast__nota">
          ℹ️ A projeção considera renda fixa, despesas fixas ativas e parcelas restantes. Gastos
          variáveis à vista (iFood, Uber...) não são previsíveis e ficam de fora.
        </p>
      </div>
    </section>
  )
}

export default Forecast
