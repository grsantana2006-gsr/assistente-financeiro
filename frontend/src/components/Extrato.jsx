import { useState } from 'react'
import { formatarMoeda, formatarDataHora, formatarMesAnoCurto } from '../utils/format'
import { obterMesFatura, rotuloMesFatura } from '../utils/fatura'
import './Extrato.css'

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

// "AAAA-MM-DD" do dia local (toISOString devolveria o dia em UTC)
function dataLocalHoje() {
  const d = new Date()
  const dois = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

// "AAAA-MM-DDTHH:mm:ss" do relógio local
function dataHoraLocalAgora() {
  const d = new Date()
  const dois = (n) => String(n).padStart(2, '0')
  return `${dataLocalHoje()}T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`
}

// Soma `n` meses a um mês 'AAAA-MM'
function somarMeses(anoMes, n) {
  const [ano, mes] = anoMes.split('-').map(Number)
  const d = new Date(ano, mes - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function Extrato({ transacoes = [], bancos = [], mesReferencia, aoAdicionar, aoAtualizar, aoRemover }) {
  const mesAtualRef = mesReferencia || new Date().toISOString().slice(0, 7)
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [bancoId, setBancoId] = useState(bancos[0]?.id ?? '')
  const [forma, setForma] = useState('Crédito')
  const [parcelas, setParcelas] = useState('1')
  const [parcelaAtual, setParcelaAtual] = useState('1')
  const [valorModo, setValorModo] = useState('total') // 'total' (divide) ou 'parcela' (valor de cada parcela)
  const [dataCompra, setDataCompra] = useState(dataLocalHoje())
  const [enviando, setEnviando] = useState(false)

  // Estado de edição de gasto
  const [editandoId, setEditandoId] = useState(null)
  const [editDescricao, setEditDescricao] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editBancoId, setEditBancoId] = useState('')
  const [editForma, setEditForma] = useState('Crédito')

  function iniciarEdicao(t) {
    setEditandoId(t.id)
    setEditDescricao(t.descricao)
    setEditValor(String(t.valor).replace('.', ','))
    setEditBancoId(String(t.banco_id))
    setEditForma(t.forma_pagamento || 'Crédito')
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
        banco_id: Number(editBancoId),
        forma_pagamento: editForma,
      })
    }
    setEditandoId(null)
  }

  function nomeDoBanco(id) {
    return bancos.find((b) => b.id === id)?.nome ?? '—'
  }
  
  function corDoBanco(id) {
    return bancos.find((b) => b.id === id)?.cor ?? '#8b5cf6'
  }

  const opcoesParcelas = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 18, 20, 24, 30, 36, 48]
  const valorNumericoAtual = Number(valor.replace(',', '.'))
  const valorValido = !Number.isNaN(valorNumericoAtual) && valorNumericoAtual > 0
  const qtdeParcelasAtual = forma === 'Voucher' ? 1 : Number(parcelas)
  const parcelaInicial = qtdeParcelasAtual > 1
    ? Math.min(Math.max(Math.trunc(Number(parcelaAtual)) || 1, 1), qtdeParcelasAtual)
    : 1
  const temDivisaoParcelas = qtdeParcelasAtual > 1 && valorValido
  const valorParcelaCalculada = temDivisaoParcelas
    ? (valorModo === 'total'
      ? Math.round((valorNumericoAtual / qtdeParcelasAtual) * 100) / 100
      : valorNumericoAtual)
    : 0
  const valorTotalCalculado = temDivisaoParcelas
    ? (valorModo === 'total'
      ? valorNumericoAtual
      : Math.round(valorNumericoAtual * qtdeParcelasAtual * 100) / 100)
    : valorNumericoAtual

  async function enviar(evento) {
    evento.preventDefault()
    if (!descricao.trim() || !valorValido) return

    setEnviando(true)
    const valorParcelaFinal = qtdeParcelasAtual > 1 ? valorParcelaCalculada : valorNumericoAtual
    const dataEscolhida = dataCompra || dataLocalHoje()

    const deuCerto = await aoAdicionar({
      descricao: descricao.trim(),
      valor: valorParcelaFinal, // O banco espera o valor de CADA parcela mensal
      banco_id: Number(bancoId || bancos[0]?.id),
      forma_pagamento: forma,
      total_parcelas: qtdeParcelasAtual,
      parcela_atual: parcelaInicial,
      // Compra de hoje guarda também a hora; datas passadas/futuras guardam só o dia
      data_compra: dataEscolhida === dataLocalHoje() ? dataHoraLocalAgora() : dataEscolhida,
    })
    setEnviando(false)

    if (deuCerto) {
      setDescricao('')
      setValor('')
      setParcelas('1')
      setParcelaAtual('1')
      setValorModo('total')
      setDataCompra(dataLocalHoje())
    }
  }

  // Número da parcela que cai no mês de referência (ex.: 4 em "4/5")
  function parcelaNoMes(t, mesRef) {
    if (!(t.total_parcelas > 1)) return null
    const banco = bancos.find((b) => b.id === t.banco_id)
    const ehCredito = t.forma_pagamento === 'Crédito' && banco && banco.tipo !== 'Benefício'
    const mesDestino = ehCredito
      ? obterMesFatura(t.data_compra, banco.dia_fechamento, banco.dia_vencimento)
      : (t.data_compra ? t.data_compra.slice(0, 7) : null)
    if (!mesDestino) return t.parcela_atual || 1
    const [anoRef, mRef] = mesRef.split('-').map(Number)
    const [anoIni, mIni] = mesDestino.split('-').map(Number)
    return (t.parcela_atual || 1) + (anoRef - anoIni) * 12 + (mRef - mIni)
  }

  function pertenceAoMes(t, mesRef) {
    const banco = bancos.find((b) => b.id === t.banco_id)
    const ehCredito = t.forma_pagamento === 'Crédito' && banco && banco.tipo !== 'Benefício'
    const mesDestino = ehCredito
      ? obterMesFatura(t.data_compra, banco.dia_fechamento, banco.dia_vencimento)
      : (t.data_compra ? t.data_compra.slice(0, 7) : null)

    if (!mesDestino) return false

    if (t.total_parcelas > 1) {
      const [anoRef, mRef] = mesRef.split('-').map(Number)
      const [anoIni, mIni] = mesDestino.split('-').map(Number)
      const diffMeses = (anoRef - anoIni) * 12 + (mRef - mIni)
      const numParcela = (t.parcela_atual || 1) + diffMeses
      return numParcela >= 1 && numParcela <= t.total_parcelas
    }

    return mesDestino === mesRef
  }

  const transacoesDoMes = transacoes.filter((t) => pertenceAoMes(t, mesAtualRef))
  const transacoesExibidas = filtroPeriodo === 'mes' ? transacoesDoMes : transacoes.slice(0, 50)

  const bancoSelecionado = bancos.find((b) => b.id === Number(bancoId || bancos[0]?.id))
  const ehCreditoForm = forma === 'Crédito' && bancoSelecionado && bancoSelecionado.tipo !== 'Benefício'
  const mesFaturaPrevista = ehCreditoForm
    ? obterMesFatura(dataCompra || dataLocalHoje(), bancoSelecionado.dia_fechamento, bancoSelecionado.dia_vencimento)
    : null
  const mesUltimaFatura = mesFaturaPrevista && qtdeParcelasAtual > 1
    ? somarMeses(mesFaturaPrevista, qtdeParcelasAtual - parcelaInicial)
    : null

  return (
    <section id="extrato-variaveis" aria-labelledby="titulo-extrato">
      <div className="secao__cabecalho">
        <h2 id="titulo-extrato">Gastos Variáveis</h2>
        <p className="card-subtitle">
          Compras do dia a dia e compras parceladas, inseridas via Bot ou formulário abaixo. Exibindo {filtroPeriodo === 'mes' ? `gastos de ${formatarMesAno(mesAtualRef)}` : 'todas as compras recentes'}.
        </p>
      </div>

      <div className="card extrato">
        {/* Formulário de novo gasto variável no topo */}
        <form className="extrato__form" onSubmit={enviar}>
          <label className="extrato__campo extrato__campo--descricao">
            <span className="extrato__rotulo">Descrição</span>
            <input
              type="text"
              placeholder="Ex.: Padaria, Tênis, Curso"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              aria-label="Descrição"
            />
          </label>
          <label className="extrato__campo extrato__campo--valor">
            <span className="extrato__rotulo">
              {qtdeParcelasAtual > 1
                ? (valorModo === 'total' ? 'Valor total da compra (R$)' : 'Valor de cada parcela (R$)')
                : 'Valor (R$)'}
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              aria-label="Valor"
            />
          </label>
          <label className="extrato__campo">
            <span className="extrato__rotulo">Data da compra</span>
            <input
              type="date"
              value={dataCompra}
              onChange={(e) => setDataCompra(e.target.value)}
              aria-label="Data da compra"
            />
          </label>
          <label className="extrato__campo">
            <span className="extrato__rotulo">Banco / Cartão</span>
            <select
              value={bancoId}
              onChange={(e) => setBancoId(e.target.value)}
              aria-label="Banco / Cartão de Origem"
            >
              {bancos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="extrato__campo">
            <span className="extrato__rotulo">Forma de pagamento</span>
            <select
              value={forma}
              onChange={(e) => {
                const novaForma = e.target.value
                setForma(novaForma)
                if (novaForma === 'Voucher') {
                  const vr = bancos.find(
                    (b) =>
                      b.tipo === 'Benefício' ||
                      b.nome.toLowerCase().includes('refeição') ||
                      b.nome.toLowerCase().includes('vale'),
                  )
                  if (vr) setBancoId(vr.id)
                }
              }}
              aria-label="Forma de Pagamento"
            >
              <option value="Crédito">Crédito</option>
              <option value="Débito">Débito</option>
              <option value="PIX">PIX</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Voucher">Voucher (Vale Refeição)</option>
            </select>
          </label>
          <label className="extrato__campo">
            <span className="extrato__rotulo">Parcelas</span>
            <select
              value={parcelas}
              onChange={(e) => {
                setParcelas(e.target.value)
                if (Number(e.target.value) <= 1) setParcelaAtual('1')
              }}
              aria-label="Parcelas"
              title="Quantidade de parcelas"
              disabled={forma === 'Voucher'}
            >
              {opcoesParcelas.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? '1x (À vista)' : `${n}x parcelado`}
                </option>
              ))}
            </select>
          </label>

          {qtdeParcelasAtual > 1 && (
            <>
              <label className="extrato__campo">
                <span className="extrato__rotulo">O valor informado é</span>
                <select
                  value={valorModo}
                  onChange={(e) => setValorModo(e.target.value)}
                  aria-label="Tipo do valor informado"
                >
                  <option value="total">Total da compra (dividir)</option>
                  <option value="parcela">Valor de cada parcela</option>
                </select>
              </label>
              <label className="extrato__campo">
                <span className="extrato__rotulo">Parcela atual (1 a {qtdeParcelasAtual})</span>
                <input
                  type="number"
                  min="1"
                  max={qtdeParcelasAtual}
                  inputMode="numeric"
                  value={parcelaAtual}
                  onChange={(e) => setParcelaAtual(e.target.value)}
                  aria-label="Parcela atual"
                  title="Use para compras que já estão em andamento (ex.: já estou na parcela 3)"
                />
              </label>
            </>
          )}

          {temDivisaoParcelas && (
            <div className="extrato__parcelas-preview">
              <span className="extrato__parcelas-preview-tag">
                {valorModo === 'total' ? 'Divisão Automática' : 'Resumo do Parcelamento'}
              </span>
              <span className="extrato__parcelas-preview-detalhe">
                <strong>{qtdeParcelasAtual}x</strong> de <strong>{formatarMoeda(valorParcelaCalculada)}</strong> / mês
              </span>
              <span className="extrato__parcelas-preview-total">
                (Valor total da compra: {formatarMoeda(valorTotalCalculado)}
                {parcelaInicial > 1 ? ` • começando na parcela ${parcelaInicial}/${qtdeParcelasAtual}` : ''})
              </span>
            </div>
          )}

          {mesFaturaPrevista && bancoSelecionado && (
            <div className="extrato__dica-fatura">
              <div className="extrato__dica-conteudo">
                {qtdeParcelasAtual > 1 ? (
                  <>
                    A parcela <strong>{parcelaInicial}/{qtdeParcelasAtual}</strong> no <strong>{bancoSelecionado.nome}</strong> entra na fatura de{' '}
                    <strong className="extrato__dica-mes">{rotuloMesFatura(mesFaturaPrevista)}</strong> e a última em{' '}
                    <strong className="extrato__dica-mes">{rotuloMesFatura(mesUltimaFatura)}</strong>
                  </>
                ) : (
                  <>
                    Esta compra no <strong>{bancoSelecionado.nome}</strong> entra na fatura de{' '}
                    <strong className="extrato__dica-mes">{rotuloMesFatura(mesFaturaPrevista)}</strong>
                  </>
                )}
                <span className="extrato__dica-datas">
                  {' '}(fecha dia {bancoSelecionado.dia_fechamento} • vence dia {bancoSelecionado.dia_vencimento})
                </span>
              </div>
            </div>
          )}

          <button type="submit" className="btn btn--primary extrato__btn-adicionar" disabled={enviando}>
            {enviando ? 'Adicionando…' : '+ Adicionar'}
          </button>
        </form>

        {/* Filtros de Período */}
        <div className="extrato__filtros" role="group" aria-label="Filtrar período do extrato">
          <button
            type="button"
            className={`extrato__filtro-btn ${filtroPeriodo === 'mes' ? 'extrato__filtro-btn--ativo' : ''}`}
            onClick={() => setFiltroPeriodo('mes')}
          >
            Deste Mês ({formatarMesAnoCurto(mesAtualRef)} - {transacoesDoMes.length})
          </button>
          <button
            type="button"
            className={`extrato__filtro-btn ${filtroPeriodo === 'todos' ? 'extrato__filtro-btn--ativo' : ''}`}
            onClick={() => setFiltroPeriodo('todos')}
          >
            Todas as Compras ({transacoes.length})
          </button>
        </div>

        {transacoesExibidas.length === 0 ? (
          <p className="extrato__vazio">
            {filtroPeriodo === 'mes'
              ? `Nenhum gasto variável registrado para ${formatarMesAno(mesAtualRef)}.`
              : 'Nenhum gasto variável registrado.'}
          </p>
        ) : (
          <ul className="extrato__lista">
            {transacoesExibidas.map((t) => {
              const banco = bancos.find((b) => b.id === t.banco_id)
              const mesFatura =
                t.forma_pagamento === 'Crédito' && banco && banco.tipo !== 'Benefício'
                  ? obterMesFatura(t.data_compra, banco.dia_fechamento, banco.dia_vencimento)
                  : null

              const emEdicao = editandoId === t.id
              const numeroParcelaExibido = filtroPeriodo === 'mes'
                ? parcelaNoMes(t, mesAtualRef)
                : (t.parcela_atual || 1)

              return (
                <li key={t.id} className="extrato__item" style={{ borderLeftColor: corDoBanco(t.banco_id) }}>
                  {emEdicao ? (
                    <div className="extrato__edicao-inline">
                      <div className="extrato__edicao-campos">
                        <input
                          type="text"
                          className="extrato__edit-input extrato__edit-input--desc"
                          value={editDescricao}
                          onChange={(e) => setEditDescricao(e.target.value)}
                          placeholder="Descrição"
                          aria-label="Descrição do gasto"
                        />
                        <input
                          type="text"
                          className="extrato__edit-input extrato__edit-input--valor"
                          value={editValor}
                          onChange={(e) => setEditValor(e.target.value)}
                          placeholder="Valor R$"
                          aria-label="Valor do gasto"
                        />
                        <select
                          className="extrato__edit-select"
                          value={editBancoId}
                          onChange={(e) => setEditBancoId(e.target.value)}
                          aria-label="Banco"
                        >
                          {bancos.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.nome}
                            </option>
                          ))}
                        </select>
                        <select
                          className="extrato__edit-select"
                          value={editForma}
                          onChange={(e) => setEditForma(e.target.value)}
                          aria-label="Forma de pagamento"
                        >
                          <option value="Crédito">Crédito</option>
                          <option value="Débito">Débito</option>
                          <option value="PIX">PIX</option>
                          <option value="Dinheiro">Dinheiro</option>
                          <option value="Voucher">Voucher</option>
                        </select>
                      </div>
                      <div className="extrato__edit-acoes">
                        <button
                          type="button"
                          className="extrato__btn-salvar"
                          title="Salvar alterações"
                          onClick={() => salvarEdicao(t.id)}
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          className="extrato__btn-cancelar"
                          title="Cancelar edição"
                          onClick={cancelarEdicao}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="extrato__info">
                        <div className="extrato__nome-linha">
                          <span className="extrato__nome">{t.descricao}</span>
                          {t.total_parcelas > 1 && (
                            <span
                              className="extrato__tag-parcela"
                              title={`Compra parcelada em ${t.total_parcelas}x de ${formatarMoeda(t.valor)}`}
                            >
                              Parcela {numeroParcelaExibido}/{t.total_parcelas}
                            </span>
                          )}
                        </div>
                        <div className="extrato__detalhes">
                          <span className="extrato__data-hora" title="Data e hora do lançamento">
                            {formatarDataHora(t.data_compra)}
                          </span>
                          <span>&bull;</span>
                          <span>{nomeDoBanco(t.banco_id)}</span>
                          <span>&bull;</span>
                          <span>{t.forma_pagamento}</span>
                          {mesFatura && (
                            <>
                              <span>&bull;</span>
                              <span className="extrato__tag-fatura" title={`Vence na fatura de ${rotuloMesFatura(mesFatura)}`}>
                                Fatura: {rotuloMesFatura(mesFatura)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="extrato__valor">{formatarMoeda(t.valor)}</span>
                      <div className="extrato__acoes">
                        <button
                          type="button"
                          className="extrato__btn-editar"
                          aria-label={`Editar ${t.descricao}`}
                          title="Editar este gasto"
                          onClick={() => iniciarEdicao(t)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="extrato__remover"
                          aria-label={`Remover ${t.descricao}`}
                          title="Excluir este gasto"
                          onClick={() => aoRemover(t.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default Extrato
