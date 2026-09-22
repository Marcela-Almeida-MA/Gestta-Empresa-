import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { ProdutosService } from '../produtos/produtos.service';
import { CalculadoraDePreco, ResultadoPrecificacao } from './calculadora-de-preco';

type DespesaFixa = { id: string; empresaId: string; descricao: string; valorMensal: number; ativo: boolean };
type DespesaAdicional = { id: string; empresaId: string; produtoId: string; descricao: string; valor: number };
type PrecificacaoSalva = ResultadoPrecificacao & { id: string; empresaId: string; produtoId: string; criadoEm: string; aplicado: boolean };

@Injectable()
export class PrecificacaoService {
  private readonly despesasFixas: DespesaFixa[] = [];
  private readonly despesasAdicionais: DespesaAdicional[] = [];
  private readonly historico: PrecificacaoSalva[] = [];
  private readonly calculadora = new CalculadoraDePreco();

  constructor(private readonly authService: AuthService, private readonly produtosService: ProdutosService) {}

  listarDespesasFixas(usuarioId: string, empresaId: string) {
    this.validarAdmin(usuarioId, empresaId);
    return this.despesasFixas.filter((item) => item.empresaId === empresaId && item.ativo);
  }

  criarDespesaFixa(usuarioId: string, empresaId: string, input: { descricao: string; valorMensal: number }) {
    this.validarAdmin(usuarioId, empresaId);
    if (!input.descricao?.trim() || input.valorMensal < 0) throw new BadRequestException('Informe descrição e valor válido.');
    const item = { id: randomUUID(), empresaId, descricao: input.descricao.trim(), valorMensal: Number(input.valorMensal), ativo: true };
    this.despesasFixas.push(item);
    return item;
  }

  inativarDespesaFixa(usuarioId: string, empresaId: string, id: string) {
    this.validarAdmin(usuarioId, empresaId);
    const item = this.despesasFixas.find((despesa) => despesa.id === id && despesa.empresaId === empresaId);
    if (!item) throw new BadRequestException('Despesa fixa não encontrada.');
    item.ativo = false;
    return item;
  }

  listarAdicionais(usuarioId: string, empresaId: string, produtoId: string) {
    this.validarAdmin(usuarioId, empresaId);
    return this.despesasAdicionais.filter((item) => item.empresaId === empresaId && item.produtoId === produtoId);
  }

  criarAdicional(usuarioId: string, empresaId: string, produtoId: string, input: { descricao: string; valor: number }) {
    this.validarAdmin(usuarioId, empresaId);
    if (!this.produtosService.obter(empresaId, produtoId)) throw new BadRequestException('Produto não encontrado.');
    if (!input.descricao?.trim() || input.valor < 0) throw new BadRequestException('Informe descrição e valor válido.');
    const item = { id: randomUUID(), empresaId, produtoId, descricao: input.descricao.trim(), valor: Number(input.valor) };
    this.despesasAdicionais.push(item);
    return item;
  }

  simular(usuarioId: string, empresaId: string, produtoId: string, lucroPercentual = 30) {
    this.validarAdmin(usuarioId, empresaId);
    const produto = this.produtosService.obter(empresaId, produtoId);
    if (!produto) throw new BadRequestException('Produto não encontrado.');
    const vendas = this.produtosService.listarMovimentacoes(empresaId).filter((item) => item.tipo === 'saida' && item.motivo === 'venda').reduce((total, item) => total + item.quantidade, 0);
    const adicionais = this.despesasAdicionais.filter((item) => item.empresaId === empresaId && item.produtoId === produtoId).reduce((total, item) => total + item.valor, 0);
    const fixas = this.despesasFixas.filter((item) => item.empresaId === empresaId && item.ativo).reduce((total, item) => total + item.valorMensal, 0);
    const empresa = this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    try {
      return this.calculadora.calcular({ despesasFixasMensais: fixas, unidadesVendidas: vendas, unidadesEstimadas: empresa.unidadesMesEstimadas, custoProduto: produto.custoUnitario, despesasAdicionais: adicionais, lucroPercentual, precoAtual: produto.precoVenda });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Não foi possível calcular o preço.');
    }
  }

  salvar(usuarioId: string, empresaId: string, produtoId: string, lucroPercentual = 30) {
    const resultado = this.simular(usuarioId, empresaId, produtoId, lucroPercentual);
    const item: PrecificacaoSalva = { ...resultado, id: randomUUID(), empresaId, produtoId, criadoEm: new Date().toISOString(), aplicado: false };
    this.historico.push(item);
    return item;
  }

  aplicar(usuarioId: string, empresaId: string, id: string) {
    this.validarAdmin(usuarioId, empresaId);
    const item = this.historico.find((precificacao) => precificacao.id === id && precificacao.empresaId === empresaId);
    if (!item) throw new BadRequestException('Precificação não encontrada.');
    this.produtosService.aplicarPreco(usuarioId, empresaId, item.produtoId, item.precoSugerido);
    item.aplicado = true;
    return item;
  }

  historicoDoProduto(usuarioId: string, empresaId: string, produtoId: string) {
    this.validarAdmin(usuarioId, empresaId);
    return this.historico.filter((item) => item.empresaId === empresaId && item.produtoId === produtoId);
  }

  private validarAdmin(usuarioId: string, empresaId: string) {
    const empresa = this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    if (empresa.papel !== 'admin') throw new UnauthorizedException('Somente administradores podem acessar a precificação.');
  }
}
