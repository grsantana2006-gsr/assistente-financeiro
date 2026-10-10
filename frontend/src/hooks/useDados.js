import { useEffect, useState } from 'react'

// =====================================================
// HOOK PERSONALIZADO: useDados
// Um "hook" é uma função que começa com "use" e reaproveita lógica de React.
// Este busca dados numa API e controla os 3 estados de qualquer requisição:
//   carregando -> aguardando a resposta
//   erro       -> algo falhou
//   dados      -> deu certo
// Ele busca de novo sempre que algum item de "dependencias" mudar.
// Importante: enquanto recarrega, MANTÉM os dados antigos na tela (sem piscar).
// =====================================================
export function useDados(buscar, dependencias) {
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: null })

  // As dependências são escolhidas por quem usa o hook, por isso o lint não consegue conferi-las.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let cancelado = false // evita atualizar a tela com uma resposta "velha"

    setEstado((atual) => ({ ...atual, carregando: true, erro: null }))

    buscar()
      .then((dados) => {
        if (!cancelado) setEstado({ dados, carregando: false, erro: null })
      })
      .catch((erro) => {
        if (!cancelado) setEstado((atual) => ({ ...atual, carregando: false, erro }))
      })

    // Função de limpeza: roda quando as dependências mudam ou o componente sai da tela
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias)

  return estado
}
