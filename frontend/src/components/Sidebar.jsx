import { useState, useEffect } from 'react'
import { formatarMoeda } from '../utils/format'
import { rotuloMesFatura } from '../utils/fatura'
import './Sidebar.css'

const ITENS_MENU = [
  { id: 'geral', label: 'Visão Geral', icone: '📊', desc: 'Painel completo' },
  { id: 'receitas', label: 'Receitas', icone: '💵', desc: 'Salários e entradas' },
  { id: 'fixas', label: 'Despesas Fixas', icone: '📌', desc: 'Contas do mês' },
  { id: 'variaveis', label: 'Gastos Variáveis', icone: '🛒', desc: 'Dia a dia e faturas' },
  { id: 'cartoes', label: 'Cartões e Limites', icone: '💳', desc: 'Ciclos de fatura' },
  { id: 'cofre', label: 'Cofre e Metas', icone: '🎯', desc: 'Reservas e economia' },
  { id: 'forecast', label: 'Forecast', icone: '🔮', desc: 'Previsão 6 a 12 meses' },
]

function Sidebar({ abaAtiva, aoMudarAba, saldoMes, statusMes, mesReferencia }) {
  const [abertoMobile, setAbertoMobile] = useState(false)

  // Fecha o menu mobile ao redimensionar para tela grande
  useEffect(() => {
    function aoRedimensionar() {
      if (window.innerWidth > 900) {
        setAbertoMobile(false)
      }
    }
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [])

  function selecionarAba(id) {
    aoMudarAba(id)
    setAbertoMobile(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const itemAtivo = ITENS_MENU.find((item) => item.id === abaAtiva) || ITENS_MENU[0]

  return (
    <>
      {/* Topbar compacta visível apenas em telas menores (Mobile / Tablet) */}
      <header className="mobile-topbar">
        <button
          type="button"
          className="mobile-topbar__btn-menu"
          onClick={() => setAbertoMobile((prev) => !prev)}
          aria-label={abertoMobile ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
          aria-expanded={abertoMobile}
        >
          <span className="mobile-topbar__icone-hamburguer">{abertoMobile ? '✕' : '☰'}</span>
          <span className="mobile-topbar__aba-atual">
            {itemAtivo.icone} {itemAtivo.label}
          </span>
        </button>

        <div className="mobile-topbar__resumo">
          <span className={`mobile-topbar__saldo ${statusMes === 'positivo' ? 'positivo' : 'negativo'}`}>
            {formatarMoeda(saldoMes)}
          </span>
        </div>
      </header>

      {/* Overlay escuro de fundo ao abrir a barra lateral no celular */}
      {abertoMobile && (
        <div
          className="sidebar-overlay"
          onClick={() => setAbertoMobile(false)}
          aria-hidden="true"
        />
      )}

      {/* Barra Lateral Principal */}
      <aside className={`sidebar ${abertoMobile ? 'sidebar--aberta' : ''}`}>
        <div className="sidebar__topo">
          <div className="sidebar__logo">
            <span className="sidebar__logo-icone">✨</span>
            <div className="sidebar__logo-textos">
              <span className="sidebar__logo-titulo">Assistente</span>
              <span className="sidebar__logo-sub">Financeiro Pessoal</span>
            </div>
          </div>
          {mesReferencia && (
            <span className="sidebar__badge-mes" title="Mês de referência dos cálculos">
              🗓️ {rotuloMesFatura(mesReferencia)}
            </span>
          )}
        </div>

        <nav className="sidebar__nav" aria-label="Navegação por setores">
          <p className="sidebar__secao-titulo">Setores do Sistema</p>
          <ul className="sidebar__menu">
            {ITENS_MENU.map((item) => {
              const estaAtivo = abaAtiva === item.id

              return (
                <li key={item.id} className="sidebar__item">
                  <button
                    type="button"
                    className={`sidebar__btn ${estaAtivo ? 'sidebar__btn--ativo' : ''}`}
                    onClick={() => selecionarAba(item.id)}
                  >
                    <span className="sidebar__icone">{item.icone}</span>
                    <div className="sidebar__textos">
                      <span className="sidebar__label">{item.label}</span>
                      <span className="sidebar__desc">{item.desc}</span>
                    </div>
                    {estaAtivo && <span className="sidebar__marcador" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="sidebar__rodape">
          <div className="sidebar__card-saldo">
            <span className="sidebar__saldo-rotulo">Saldo Líquido Previsto</span>
            <span className={`sidebar__saldo-valor ${statusMes === 'positivo' ? 'positivo' : 'negativo'}`}>
              {formatarMoeda(saldoMes)}
            </span>
            <span className="sidebar__saldo-dica">
              {statusMes === 'positivo' ? '🟢 Margem positiva' : '🔴 Atenção ao limite'}
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
