import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ProdutosService } from '../produtos/produtos.service';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly produtosService: ProdutosService,
    private readonly authService: AuthService,
  ) {}

  @Get('resumo')
  resumo(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string, @Query('de') de?: string, @Query('ate') ate?: string) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    return this.dashboardService.resumo(usuarioId, empresaId, de, ate);
  }

  @Get('movimentacao-por-periodo')
  movimentacaoPorPeriodo(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string, @Query('de') de?: string, @Query('ate') ate?: string) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    return this.dashboardService.movimentacaoPorPeriodo(usuarioId, empresaId, de, ate);
  }

  @Get('movimentacoes')
  movimentacoes(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    return this.produtosService.listarMovimentacoes(empresaId);
  }

  @Post('movimentacoes')
  registrarMovimentacao(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string, @Body() body: { produtoId: string; tipo: 'entrada' | 'saida'; quantidade: number; valorUnitario?: number; motivo?: string }) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    return this.produtosService.registrarMovimentacao(usuarioId, empresaId, body);
  }

  @Patch('movimentacoes/:id')
  atualizarMovimentacao(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string, @Param('id') id: string, @Body() body: { tipo: 'entrada' | 'saida'; quantidade: number; valorUnitario?: number; motivo?: string }) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    return this.produtosService.atualizarMovimentacao(usuarioId, empresaId, id, body);
  }
}
