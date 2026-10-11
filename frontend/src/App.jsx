import { useState } from 'react'
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
  const recarregar = () => setVersao((v) => v + 1)

  // ---------- Leitura: 3 chamadas à API ----------
  const dashboard = useDados(() => api.obterDashboard(MES_REFERENCIA), [versao])
  const fixas = useDados(() => api.listarDespesasFixas(MES_REFERENCIA), [versao])
  const extrato = useDados(() => api.listarDespesasVariaveis(), [versao])
  const receitas = useDados(() => api.listarReceitas(), [versao])
  const cofre = useDados(() => api.obterCofre(), [versao])
  const forecast = useDados(() => api.obterForecast(MES_REFERENCIA, 12), [versao])

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

  const alternarPagamentoFixa = (id) =>
    executar(() => api.alternarPagamentoFixa(id, MES_REFERENCIA))

  const adicionarVariavel = (dados) =>
    executar(() => api.criarTransacao({ ...dados, tipo: 'Despesa', categoria: 'Variável' }))

  const adicionarReceita = (dados) => executar(() => api.criarTransacao(dados))

  const alternarFixa = (fixa) => executar(() => api.atualizarTransacao(fixa.id, { ativa: !fixa.ativa }))
  const atualizarFixa = (id, dados) => executar(() => api.atualizarTransacao(id, dados))

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

  const { total_cofre, receita_mes, faturas_abertas, cartoes } = dashboard.dados

  return (
    <main className="app">
      <StatusHeader totalCofre={total_cofre} receitaMes={receita_mes} faturasAbertas={faturas_abertas} />
      <Receitas
        receitas={receitas.dados}
        bancos={cartoes}
        aoAdicionar={adicionarReceita}
        aoAlternar={alternarFixa}
        aoRemover={removerFixa}
      />
      <DespesasFixas
        fixas={fixas.dados}
        bancos={cartoes}
        mesReferencia={MES_REFERENCIA}
        aoAdicionar={adicionarFixa}
        aoAlternar={alternarFixa}
        aoAtualizar={atualizarFixa}
        aoAlternarPagamento={alternarPagamentoFixa}
        aoRemover={removerFixa}
      />
      <Extrato 
        transacoes={extrato.dados} 
        bancos={cartoes} 
        aoAdicionar={adicionarVariavel} 
        aoRemover={removerFixa} 
      />
      <Cofre 
        cofre={cofre.dados} 
        aoAdicionar={adicionarCofre} 
        aoAtualizar={atualizarCofre} 
        aoRemover={removerCofre} 
      />
      <PainelCartoes cartoes={cartoes} aoSalvarLimite={salvarLimite} />
      <Forecast projecao={forecast.dados.projecao} />

      {/* Se uma ação falhar, ou uma atualização em segundo plano falhar, avisamos aqui */}
      <Toast mensagem={aviso ?? (erro ? erro.message : null)} aoFechar={() => setAviso(null)} />
    </main>
  )
}

export default App
