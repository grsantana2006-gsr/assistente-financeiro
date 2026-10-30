import { useMemo } from 'react'
import {
  mesAnterior,
  proximoMes,
  obterMesAtual,
  gerarOpcoesMeses,
} from '../utils/meses'
import './SeletorMes.css'

function SeletorMes({ mesReferencia, aoMudarMes }) {
  const mesAtualHoje = obterMesAtual()
  const ehMesAtual = mesReferencia === mesAtualHoje

  const opcoes = useMemo(() => gerarOpcoesMeses(mesReferencia), [mesReferencia])

  function irParaAnterior() {
    aoMudarMes(mesAnterior(mesReferencia))
  }

  function irParaProximo() {
    aoMudarMes(proximoMes(mesReferencia))
  }

  function irParaHoje() {
    aoMudarMes(mesAtualHoje)
  }

  function aoSelecionar(evento) {
    aoMudarMes(evento.target.value)
  }

  return (
    <nav className="seletor-mes" aria-label="Navegação por mês de referência">
      <div className="seletor-mes__grupo">
        <button
          id="btn-mes-anterior"
          type="button"
          className="seletor-mes__btn"
          onClick={irParaAnterior}
          title="Ver mês anterior"
        >
          Anterior
        </button>

        <div className="seletor-mes__seletor">
          <label htmlFor="select-mes-referencia" className="sr-only">
            Selecionar mês de referência
          </label>
          <select
            id="select-mes-referencia"
            className="seletor-mes__select"
            value={mesReferencia}
            onChange={aoSelecionar}
            title="Escolha um mês para consultar"
          >
            {opcoes.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </div>

        <button
          id="btn-mes-proximo"
          type="button"
          className="seletor-mes__btn"
          onClick={irParaProximo}
          title="Ver próximo mês"
        >
          Próximo
        </button>
      </div>

      {!ehMesAtual && (
        <button
          id="btn-mes-atual"
          type="button"
          className="seletor-mes__btn-hoje"
          onClick={irParaHoje}
          title="Voltar para o mês atual"
        >
          Mês Atual
        </button>
      )}
    </nav>
  )
}

export default SeletorMes
