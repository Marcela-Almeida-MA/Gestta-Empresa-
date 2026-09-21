import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
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

@Injectable()
export class ProdutosService {
  private readonly produtos: Produto[] = [];

  constructor(private readonly authService: AuthService) {}

  listar(empresaId: string) {
    return this.produtos.filter((produto) => produto.empresaId === empresaId);
  }

  criar(usuarioId: string, empresaId: string, input: { nome: string; sku: string; descricao?: string; categoriaId?: string | null; custoUnitario: number; precoVenda: number; estoqueMinimo: number; quantidadeInicial?: number }) {
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

    const produto: Produto = {
      id: randomUUID(),
      empresaId,
      nome,
      sku,
      descricao: input.descricao ?? '',
      categoriaId: input.categoriaId ?? null,
      fotoUrl: null,
      custoUnitario: Number(input.custoUnitario),
      precoVenda: Number(input.precoVenda),
      quantidadeAtual: Number(input.quantidadeInicial ?? 0),
      estoqueMinimo: Number(input.estoqueMinimo ?? 0),
      ativo: true,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    this.produtos.push(produto);
    return produto;
  }

  atualizar(usuarioId: string, empresaId: string, produtoId: string, input: { nome?: string; sku?: string; descricao?: string; categoriaId?: string | null; custoUnitario?: number; precoVenda?: number; estoqueMinimo?: number; ativo?: boolean }) {
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
    const vinculo = this.authService['vinculos']?.find(
      (item: any) => item.usuarioId === usuarioId && item.empresaId === empresaId,
    );

    if (!vinculo || vinculo.papel !== 'admin') {
      throw new UnauthorizedException('Somente administradores podem gerenciar produtos.');
    }
  }
}
