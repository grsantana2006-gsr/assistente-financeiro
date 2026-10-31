import { useState } from 'react'
import Sidebar from './components/Sidebar'
import StatusHeader from './components/StatusHeader'
import DespesasFixas from './components/DespesasFixas'
import Forecast from './components/Forecast'
import PainelCartoes from './components/PainelCartoes'
import Extrato from './components/Extrato'
import Receitas from './components/Receitas'
import Cofre from './components/Cofre'
import { TelaCarregando, TelaErro, Toast } from './components/Feedback'
import { useDados } from './hooks/useDados'
import { api } from './services/api'
import { MES_REFERENCIA } from './config'
import './App.css'

// App é o "componente raiz". Agora ele não calcula mais nada:
// pede os números prontos ao servidor e distribui para os módulos da tela.
function App() {
  // "versao" é um contador. Toda vez que ele muda, os dados são buscados de novo.
  // É assim que a tela se atualiza depois de uma alteração.
  const [versao, setVersao] = useState(0)
  const [aviso, setAviso] = useState(null)
  const [abaAtiva, setAbaAtiva] = useState('geral')
  const [mesReferencia, setMesReferencia] = useState(
    () => sessionStorage.getItem('assistente_mes_referencia') || MES_REFERENCIA
  )
  const recarregar = () => setVersao((v) => v + 1)

  const mudarMesReferencia = (novoMes) => {
    setMesReferencia(novoMes)
    try {
      sessionStorage.setItem('assistente_mes_referencia', novoMes)
    } catch {
      // Ignora erro se indisponível
    }
  }

  // ---------- Leitura: chamadas à API ----------
  const dashboard = useDados(() => api.obterDashboard(mesReferencia), [versao, mesReferencia])
  const fixas = useDados(() => api.listarDespesasFixas(mesReferencia), [versao, mesReferencia])
  const extrato = useDados(() => api.listarDespesasVariaveis(), [versao])
  const receitas = useDados(() => api.listarReceitas(), [versao])
  const cofre = useDados(() => api.obterCofre(), [versao])
  const forecast = useDados(() => api.obterForecast(mesReferencia, 12), [versao, mesReferencia])

  // ---------- Escrita ----------
  // Executa uma ação na API; se der certo, recarrega os dados. Se falhar, mostra um aviso.
  // Devolve true/false para o componente saber se pode, por exemplo, limpar o formulário.
  async function executar(acao) {
    try {
      await acao()
      recarregar()
      return true
    } catch (erro) {
      setAviso(erro.message)
      return false
    }
  }

  const salvarLimite = (bancoId, limite) => executar(() => api.atualizarBanco(bancoId, { limite_total: limite }))

  const adicionarFixa = (dados) =>
    executar(() => api.criarTransacao({ ...dados, tipo: 'Despesa', categoria: 'Fixo' }))

  const alternarPagamentoFixa = (id, mes) =>
    executar(() => api.alternarPagamentoFixa(id, mes || mesReferencia))

  const alternarPagamentoFatura = (bancoId, dados) =>
    executar(() => api.alternarPagamentoFatura(bancoId, dados || mesReferencia))

  const adicionarAdiantamentoFatura = (bancoId, dados) =>
    executar(() => api.adicionarAdiantamentoFatura(bancoId, dados))

  const removerAdiantamentoFatura = (bancoId, pagamentoId) =>
    executar(() => api.removerAdiantamentoFatura(bancoId, pagamentoId))

  const adicionarVariavel = (dados) =>
    executar(() => api.criarTransacao({ ...dados, tipo: 'Despesa', categoria: 'Variável' }))

  const adicionarReceita = (dados) => executar(() => api.criarTransacao(dados))

  const alternarFixa = (fixa) => executar(() => api.atualizarTransacao(fixa.id, { ativa: !fixa.ativa }))
  const atualizarTransacao = (id, dados) => executar(() => api.atualizarTransacao(id, dados))

  const removerFixa = (id) => executar(() => api.removerTransacao(id))

  const adicionarCofre = (dados) => executar(() => api.criarCofre(dados))
  const atualizarCofre = (id, dados) => executar(() => api.atualizarCofre(id, dados))
  const removerCofre = (id) => executar(() => api.removerCofre(id))

  // ---------- Estados da tela ----------
  const requisicoes = [dashboard, fixas, forecast, extrato, receitas, cofre]
  const primeiroCarregamento = requisicoes.some((r) => r.dados === null)
  const erro = requisicoes.find((r) => r.erro)?.erro

  if (primeiroCarregamento) {
    return erro ? <TelaErro mensagem={erro.message} aoTentarNovamente={recarregar} /> : <TelaCarregando />
  }

  const {
    total_cofre,
    receita_mes,
    faturas_cartao,
    faturas_abertas,
    faturas_pagas_total,
    faturas_pendentes_total,
    qtd_faturas_pagas,
    qtd_faturas_total,
    todas_faturas_pagas,
    despesas_conta_pix,
    saldo_mes,
    status_mes,
    cartoes,
    itens_faturas,
    itens_conta_pix,
  } = dashboard.dados

  return (
    <div className="layout-principal">
      <Sidebar
        abaAtiva={abaAtiva}
        aoMudarAba={setAbaAtiva}
        saldoMes={saldo_mes ?? (receita_mes - (faturas_pendentes_total ?? faturas_abertas ?? 0) - (despesas_conta_pix ?? 0))}
        statusMes={status_mes ?? (saldo_mes >= 0 ? 'positivo' : 'negativo')}
        mesReferencia={mesReferencia}
      />

      <div className="layout-conteudo">
        <main className="app">
          {/* Header de Status rápido sempre disponível */}
          <StatusHeader
            totalCofre={total_cofre}
            receitaMes={receita_mes}
            faturasCartao={faturas_cartao ?? faturas_abertas}
            faturasPagasTotal={faturas_pagas_total ?? 0}
            faturasPendentesTotal={faturas_pendentes_total ?? faturas_abertas}
            qtdFaturasPagas={qtd_faturas_pagas ?? 0}
            qtdFaturasTotal={qtd_faturas_total ?? 0}
            todasFaturasPagas={todas_faturas_pagas ?? false}
            despesasContaPix={despesas_conta_pix ?? 0}
            saldoMes={saldo_mes ?? (receita_mes - (faturas_pendentes_total ?? faturas_abertas ?? 0) - (despesas_conta_pix ?? 0))}
            statusMes={status_mes ?? (saldo_mes >= 0 ? 'positivo' : 'negativo')}
            mesReferencia={mesReferencia}
            aoMudarMes={mudarMesReferencia}
            itensFaturas={itens_faturas || []}
            itensContaPix={itens_conta_pix || []}
            cartoes={cartoes || []}
          />

          {(abaAtiva === 'geral' || abaAtiva === 'receitas') && (
            <Receitas
              receitas={receitas.dados}
              bancos={cartoes}
              mesReferencia={mesReferencia}
              aoAdicionar={adicionarReceita}
              aoAtualizar={atualizarTransacao}
              aoAlternar={alternarFixa}
              aoRemover={removerFixa}
            />
          )}

          {(abaAtiva === 'geral' || abaAtiva === 'fixas') && (
            <DespesasFixas
              fixas={fixas.dados}
              bancos={cartoes}
              mesReferencia={mesReferencia}
              aoAdicionar={adicionarFixa}
              aoAlternar={alternarFixa}
              aoAtualizar={atualizarTransacao}
              aoAlternarPagamento={alternarPagamentoFixa}
              aoRemover={removerFixa}
            />
          )}

          {(abaAtiva === 'geral' || abaAtiva === 'variaveis') && (
            <Extrato
              transacoes={extrato.dados}
              bancos={cartoes}
              mesReferencia={mesReferencia}
              aoAdicionar={adicionarVariavel}
              aoAtualizar={atualizarTransacao}
              aoRemover={removerFixa}
            />
          )}

          {(abaAtiva === 'geral' || abaAtiva === 'cartoes') && (
            <PainelCartoes
              cartoes={cartoes}
              aoSalvarLimite={salvarLimite}
              aoAlternarFatura={alternarPagamentoFatura}
              aoAdicionarAdiantamento={adicionarAdiantamentoFatura}
              aoRemoverAdiantamento={removerAdiantamentoFatura}
              mesReferencia={mesReferencia}
            />
          )}

          {(abaAtiva === 'geral' || abaAtiva === 'cofre') && (
            <Cofre
              cofre={cofre.dados}
              aoAdicionar={adicionarCofre}
              aoAtualizar={atualizarCofre}
              aoRemover={removerCofre}
            />
          )}

          {(abaAtiva === 'geral' || abaAtiva === 'forecast') && (
            <Forecast projecao={forecast.dados.projecao} />
          )}

          {/* Se uma ação falhar, ou uma atualização em segundo plano falhar, avisamos aqui */}
          <Toast mensagem={aviso ?? (erro ? erro.message : null)} aoFechar={() => setAviso(null)} />
        </main>
      </div>
    </div>
  )
}

export default App
