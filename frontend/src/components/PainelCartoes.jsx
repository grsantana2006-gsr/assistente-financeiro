import CartaoBanco from './CartaoBanco'
import './PainelCartoes.css'

// Painel que agrupa os cards de todos os bancos.
// Cada "cartao" já chega do servidor com gasto, limite_disponivel e uso calculados.
function PainelCartoes({ cartoes, aoSalvarLimite, aoAlternarFatura, mesReferencia }) {
  return (
    <section id="painel-cartoes" aria-labelledby="titulo-cartoes">
      <div className="secao__cabecalho">
        <h2 id="titulo-cartoes">Painel de Cartões</h2>
        <p className="card-subtitle">
          Acompanhe o limite consumido, confira a fatura do mês e marque o pagamento para restabelecer seu limite.
        </p>
      </div>

      <div className="painel-cartoes__grid">
        {cartoes.map((cartao) => (
          <CartaoBanco
            key={cartao.id}
            cartao={cartao}
            aoSalvarLimite={aoSalvarLimite}
            aoAlternarFatura={aoAlternarFatura}
            mesReferencia={mesReferencia}
          />
        ))}
      </div>
    </section>
  )
}

export default PainelCartoes
