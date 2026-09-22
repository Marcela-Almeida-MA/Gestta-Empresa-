import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ProdutosService } from './produtos.service';

@Controller('produtos')
export class ProdutosController {
  constructor(
    private readonly produtosService: ProdutosService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  listar(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    return this.produtosService.listar(empresaId);
  }

  @Post()
  criar(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string, @Body() body: { nome: string; sku: string; descricao?: string; categoriaId?: string | null; fotoUrl?: string | null; custoUnitario: number; precoVenda: number; estoqueMinimo: number; quantidadeInicial?: number }) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    return this.produtosService.criar(usuarioId, empresaId, body);
  }

  @Patch(':id')
  atualizar(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string, @Param('id') id: string, @Body() body: { nome?: string; sku?: string; descricao?: string; categoriaId?: string | null; fotoUrl?: string | null; custoUnitario?: number; precoVenda?: number; estoqueMinimo?: number; ativo?: boolean }) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    return this.produtosService.atualizar(usuarioId, empresaId, id, body);
  }

  @Patch(':id/inativar')
  inativar(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string, @Param('id') id: string) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    return this.produtosService.inativar(usuarioId, empresaId, id);
  }
}
