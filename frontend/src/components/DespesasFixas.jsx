import { useState } from 'react'
import { formatarMoeda } from '../utils/format'
import './DespesasFixas.css'

// Módulo de Despesas Fixas: lista, adiciona, pausa e remove contas recorrentes.
// Os dados vivem no servidor; aqui só exibimos e avisamos o pai do que o usuário fez.
// - fixas: lista já filtrada pela API (somente despesas fixas)
// - bancos: usados no seletor e para mostrar o nome do banco
function DespesasFixas({ fixas, bancos, aoAdicionar, aoAlternar, aoRemover, aoAtualizar }) {
  // "Formulário controlado": cada campo tem seu estado, e o input mostra esse estado.
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [bancoId, setBancoId] = useState(bancos[0]?.id ?? '')
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().split('T')[0])
  const [enviando, setEnviando] = useState(false)

  // Total mensal: soma só as que estão ativas
  const totalMensal = fixas.filter((t) => t.ativa).reduce((soma, t) => soma + t.valor, 0)

  function nomeDoBanco(id) {
    return bancos.find((b) => b.id === id)?.nome ?? '—'
  }

  async function enviar(evento) {
    evento.preventDefault()
    const valorNumerico = Number(valor.replace(',', '.'))
    if (!descricao.trim() || Number.isNaN(valorNumerico) || valorNumerico <= 0) return

    setEnviando(true)
    const deuCerto = await aoAdicionar({
      descricao: descricao.trim(),
      valor: valorNumerico,
      banco_id: Number(bancoId),
      data_compra: dataCompra || undefined,
    })
    setEnviando(false)

    // Só limpa o formulário se o servidor aceitou (senão o usuário não perde o que digitou)
    if (deuCerto) {
      setDescricao('')
      setValor('')
    }
  }

  return (
    <section id="despesas-fixas" aria-labelledby="titulo-fixas">
      <div className="secao__cabecalho">
        <h2 id="titulo-fixas">Despesas Fixas</h2>
        <p className="card-subtitle">Contas recorrentes que são abatidas todo mês automaticamente.</p>
      </div>

      <div className="card fixas">
        <div className="fixas__total">
          <p className="card-subtitle">Total mensal (apenas ativas)</p>
          <p className="fixas__total-valor negative">{formatarMoeda(totalMensal)}</p>
        </div>

        {fixas.length === 0 ? (
          <p className="fixas__vazio">Nenhuma despesa fixa cadastrada ainda.</p>
        ) : (
          <ul className="fixas__lista">
            {fixas.map((t) => {
              const ativa = t.ativa
              return (
                <li key={t.id} className={`fixas__item ${ativa ? '' : 'fixas__item--pausada'}`}>
                  <div className="fixas__info">
                    <span className="fixas__nome">{t.descricao}</span>
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

                  {/* Interruptor ativar/pausar */}
                  <button
                    id={`alternar-fixa-${t.id}`}
                    type="button"
                    role="switch"
                    aria-checked={ativa}
                    aria-label={`${ativa ? 'Pausar' : 'Ativar'} ${t.descricao}`}
                    className={`interruptor ${ativa ? 'interruptor--ligado' : ''}`}
                    onClick={() => aoAlternar(t)}
                  />

                  <button
                    id={`remover-fixa-${t.id}`}
                    type="button"
                    className="fixas__remover"
                    aria-label={`Remover ${t.descricao}`}
                    onClick={() => aoRemover(t.id)}
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <form className="fixas__form" onSubmit={enviar}>
          <input
            id="fixa-descricao"
            type="text"
            placeholder="Ex.: Plano de saúde"
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
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
          </select>
          <button id="fixa-adicionar" type="submit" className="btn btn--primary" disabled={enviando}>
            {enviando ? 'Adicionando…' : '+ Adicionar'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default DespesasFixas
