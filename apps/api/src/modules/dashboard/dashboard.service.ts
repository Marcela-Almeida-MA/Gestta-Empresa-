import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ProdutosService } from '../produtos/produtos.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly authService: AuthService,
    private readonly produtosService: ProdutosService,
  ) {}

  resumo(usuarioId: string, empresaId: string, de?: string, ate?: string) {
    this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    const movimentacoes = this.filtrarPorPeriodo(this.produtosService.listarMovimentacoes(empresaId), de, ate);
    const produtos = this.produtosService.listar(empresaId).filter((produto) => produto.ativo);
    const entradas = movimentacoes.filter((item) => item.tipo === 'entrada');
    const saidas = movimentacoes.filter((item) => item.tipo === 'saida');

    return {
      periodo: { de: de ?? null, ate: ate ?? null },
      unidadesEntrada: entradas.reduce((total, item) => total + item.quantidade, 0),
      unidadesSaida: saidas.reduce((total, item) => total + item.quantidade, 0),
      saldoUnidades: entradas.reduce((total, item) => total + item.quantidade, 0) - saidas.reduce((total, item) => total + item.quantidade, 0),
      produtosEstoqueBaixo: produtos.filter((produto) => produto.quantidadeAtual <= produto.estoqueMinimo).length,
      financeiro: {
        totalEntradas: entradas.reduce((total, item) => total + item.quantidade * item.valorUnitario, 0),
        totalSaidas: saidas.reduce((total, item) => total + item.quantidade * item.valorUnitario, 0),
        valorEmEstoque: produtos.reduce((total, produto) => total + produto.quantidadeAtual * produto.custoUnitario, 0),
        lucroBruto: saidas.filter((item) => item.motivo === 'venda').reduce((total, item) => {
          const produto = produtos.find((itemProduto) => itemProduto.id === item.produtoId);
          return total + item.quantidade * (item.valorUnitario - (produto?.custoUnitario ?? 0));
        }, 0),
      },
    };
  }

  movimentacaoPorPeriodo(usuarioId: string, empresaId: string, de?: string, ate?: string) {
    this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    const porDia = new Map<string, { periodo: string; entradas: number; saidas: number }>();

    for (const movimentacao of this.filtrarPorPeriodo(this.produtosService.listarMovimentacoes(empresaId), de, ate)) {
      const periodo = movimentacao.criadoEm.slice(0, 10);
      const atual = porDia.get(periodo) ?? { periodo, entradas: 0, saidas: 0 };
      if (movimentacao.tipo === 'entrada') atual.entradas += movimentacao.quantidade;
      else atual.saidas += movimentacao.quantidade;
      porDia.set(periodo, atual);
    }

    return [...porDia.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
  }

  private filtrarPorPeriodo<T extends { criadoEm: string }>(itens: T[], de?: string, ate?: string) {
    return itens.filter((item) => (!de || item.criadoEm.slice(0, 10) >= de) && (!ate || item.criadoEm.slice(0, 10) <= ate));
  }
}
