import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../auth/auth.service';

export type Produto = {
  id: string;
  empresaId: string;
  nome: string;
  sku: string;
  descricao?: string;
  categoriaId?: string | null;
  fotoUrl?: string | null;
  custoUnitario: number;
  precoVenda: number;
  quantidadeAtual: number;
  estoqueMinimo: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

export type Movimentacao = {
  id: string;
  empresaId: string;
  produtoId: string;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  valorUnitario: number;
  motivo: string;
  criadoEm: string;
};

@Injectable()
export class ProdutosService {
  private readonly produtos: Produto[] = [];
  private readonly movimentacoes: Movimentacao[] = [];

  constructor(private readonly authService: AuthService) {}

  listar(empresaId: string) {
    return this.produtos.filter((produto) => produto.empresaId === empresaId);
  }

  obter(empresaId: string, produtoId: string) {
    return this.produtos.find((produto) => produto.empresaId === empresaId && produto.id === produtoId);
  }

  aplicarPreco(usuarioId: string, empresaId: string, produtoId: string, precoVenda: number) {
    this.validarAdmin(usuarioId, empresaId);
    const produto = this.obter(empresaId, produtoId);
    if (!produto) throw new BadRequestException('Produto não encontrado.');
    produto.precoVenda = precoVenda;
    produto.atualizadoEm = new Date().toISOString();
    return produto;
  }

  listarMovimentacoes(empresaId: string) {
    return this.movimentacoes.filter((movimentacao) => movimentacao.empresaId === empresaId);
  }

  registrarMovimentacao(usuarioId: string, empresaId: string, input: { produtoId: string; tipo: 'entrada' | 'saida'; quantidade: number; valorUnitario?: number; motivo?: string }) {
    this.validarMembro(usuarioId, empresaId);
    const produto = this.produtos.find((item) => item.id === input.produtoId && item.empresaId === empresaId);

    if (!produto) throw new BadRequestException('Produto não encontrado.');
    if (!produto.ativo) throw new BadRequestException('Produto inativo.');
    if (!Number.isInteger(input.quantidade) || input.quantidade < 1) {
      throw new BadRequestException('A quantidade deve ser um inteiro maior que zero.');
    }
    if (input.tipo === 'saida' && produto.quantidadeAtual < input.quantidade) {
      throw new BadRequestException('Saldo insuficiente para esta saída.');
    }

    produto.quantidadeAtual += input.tipo === 'entrada' ? input.quantidade : -input.quantidade;
    produto.atualizadoEm = new Date().toISOString();
    const movimentacao: Movimentacao = {
      id: randomUUID(),
      empresaId,
      produtoId: produto.id,
      tipo: input.tipo,
      quantidade: input.quantidade,
      valorUnitario: Number(input.valorUnitario ?? produto.precoVenda),
      motivo: input.motivo ?? (input.tipo === 'entrada' ? 'reposição' : 'venda'),
      criadoEm: new Date().toISOString(),
    };
    this.movimentacoes.push(movimentacao);
    return movimentacao;
  }

  atualizarMovimentacao(usuarioId: string, empresaId: string, movimentacaoId: string, input: { tipo: 'entrada' | 'saida'; quantidade: number; valorUnitario?: number; motivo?: string }) {
    this.validarMembro(usuarioId, empresaId);
    const movimentacao = this.movimentacoes.find((item) => item.id === movimentacaoId && item.empresaId === empresaId);
    if (!movimentacao) throw new BadRequestException('Movimentação não encontrada.');
    if (!Number.isInteger(input.quantidade) || input.quantidade < 1) throw new BadRequestException('A quantidade deve ser um inteiro maior que zero.');

    const produto = this.obter(empresaId, movimentacao.produtoId);
    if (!produto) throw new BadRequestException('Produto não encontrado.');
    produto.quantidadeAtual += movimentacao.tipo === 'entrada' ? -movimentacao.quantidade : movimentacao.quantidade;
    if (input.tipo === 'saida' && produto.quantidadeAtual < input.quantidade) {
      produto.quantidadeAtual += movimentacao.tipo === 'entrada' ? movimentacao.quantidade : -movimentacao.quantidade;
      throw new BadRequestException('Saldo insuficiente para editar esta saída.');
    }

    produto.quantidadeAtual += input.tipo === 'entrada' ? input.quantidade : -input.quantidade;
    produto.atualizadoEm = new Date().toISOString();
    movimentacao.tipo = input.tipo;
    movimentacao.quantidade = input.quantidade;
    movimentacao.valorUnitario = Number(input.valorUnitario ?? movimentacao.valorUnitario);
    movimentacao.motivo = input.motivo ?? movimentacao.motivo;
    return movimentacao;
  }

  criar(usuarioId: string, empresaId: string, input: { nome: string; sku: string; descricao?: string; categoriaId?: string | null; fotoUrl?: string | null; custoUnitario: number; precoVenda: number; estoqueMinimo: number; quantidadeInicial?: number }) {
    this.validarAdmin(usuarioId, empresaId);
    const nome = input.nome?.trim();
    const sku = input.sku?.trim();

    if (!nome || nome.length < 2) {
      throw new BadRequestException('O nome do produto deve ter pelo menos 2 caracteres.');
    }

    if (!sku || sku.length < 2) {
      throw new BadRequestException('O SKU é obrigatório.');
    }

    if (this.produtos.some((produto) => produto.empresaId === empresaId && produto.sku.toLowerCase() === sku.toLowerCase())) {
      throw new BadRequestException('Já existe um produto com esse SKU na empresa.');
    }

    if (input.custoUnitario < 0 || input.precoVenda < 0 || input.estoqueMinimo < 0) {
      throw new BadRequestException('Valores de custo, preço e estoque mínimo não podem ser negativos.');
    }

    const quantidadeInicial = Number(input.quantidadeInicial ?? 0);
    if (!Number.isInteger(quantidadeInicial) || quantidadeInicial < 0) {
      throw new BadRequestException('O estoque inicial deve ser um número inteiro igual ou maior que zero.');
    }

    const produto: Produto = {
      id: randomUUID(),
      empresaId,
      nome,
      sku,
      descricao: input.descricao ?? '',
      categoriaId: input.categoriaId ?? null,
      fotoUrl: input.fotoUrl ?? null,
      custoUnitario: Number(input.custoUnitario),
      precoVenda: Number(input.precoVenda),
      quantidadeAtual: 0,
      estoqueMinimo: Number(input.estoqueMinimo ?? 0),
      ativo: true,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    this.produtos.push(produto);
    if (quantidadeInicial > 0) {
      this.registrarMovimentacao(usuarioId, empresaId, {
        produtoId: produto.id,
        tipo: 'entrada',
        quantidade: quantidadeInicial,
        valorUnitario: produto.custoUnitario,
        motivo: 'estoque_inicial',
      });
    }
    return produto;
  }

  atualizar(usuarioId: string, empresaId: string, produtoId: string, input: { nome?: string; sku?: string; descricao?: string; categoriaId?: string | null; fotoUrl?: string | null; custoUnitario?: number; precoVenda?: number; estoqueMinimo?: number; ativo?: boolean }) {
    this.validarAdmin(usuarioId, empresaId);
    const produto = this.produtos.find((item) => item.empresaId === empresaId && item.id === produtoId);

    if (!produto) {
      throw new BadRequestException('Produto não encontrado.');
    }

    if (input.nome) {
      produto.nome = input.nome.trim();
    }

    if (input.sku) {
      const sku = input.sku.trim();
      const conflito = this.produtos.some(
        (item) => item.empresaId === empresaId && item.id !== produtoId && item.sku.toLowerCase() === sku.toLowerCase(),
      );

      if (conflito) {
        throw new BadRequestException('Já existe outro produto com esse SKU.');
      }

      produto.sku = sku;
    }

    if (input.descricao !== undefined) produto.descricao = input.descricao;
    if (input.categoriaId !== undefined) produto.categoriaId = input.categoriaId ?? null;
    if (input.fotoUrl !== undefined) produto.fotoUrl = input.fotoUrl ?? null;
    if (input.custoUnitario !== undefined) produto.custoUnitario = Number(input.custoUnitario);
    if (input.precoVenda !== undefined) produto.precoVenda = Number(input.precoVenda);
    if (input.estoqueMinimo !== undefined) produto.estoqueMinimo = Number(input.estoqueMinimo);
    if (input.ativo !== undefined) produto.ativo = Boolean(input.ativo);

    produto.atualizadoEm = new Date().toISOString();
    return produto;
  }

  inativar(usuarioId: string, empresaId: string, produtoId: string) {
    this.validarAdmin(usuarioId, empresaId);
    const produto = this.produtos.find((item) => item.empresaId === empresaId && item.id === produtoId);

    if (!produto) {
      throw new BadRequestException('Produto não encontrado.');
    }

    produto.ativo = false;
    produto.atualizadoEm = new Date().toISOString();
    return produto;
  }

  private validarAdmin(usuarioId: string, empresaId: string) {
    const vinculo = this.obterVinculo(usuarioId, empresaId);

    if (vinculo?.papel !== 'admin') {
      throw new UnauthorizedException('Somente administradores podem gerenciar produtos.');
    }
  }

  private validarMembro(usuarioId: string, empresaId: string) {
    if (!this.obterVinculo(usuarioId, empresaId)) {
      throw new UnauthorizedException('Usuário não participa desta empresa.');
    }
  }

  private obterVinculo(usuarioId: string, empresaId: string) {
    return this.authService['vinculos']?.find(
      (item: any) => item.usuarioId === usuarioId && item.empresaId === empresaId,
    );
  }
}
