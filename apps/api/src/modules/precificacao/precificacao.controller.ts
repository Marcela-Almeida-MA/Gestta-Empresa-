import { Body, Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PrecificacaoService } from './precificacao.service';

@Controller()
export class PrecificacaoController {
  constructor(private readonly service: PrecificacaoService, private readonly authService: AuthService) {}

  @Get('despesas-fixas')
  listarFixas(@Headers('authorization') auth: string, @Headers('x-empresa-id') empresaId: string) { return this.service.listarDespesasFixas(this.usuario(auth), empresaId); }

  @Post('despesas-fixas')
  criarFixa(@Headers('authorization') auth: string, @Headers('x-empresa-id') empresaId: string, @Body() body: { descricao: string; valorMensal: number }) { return this.service.criarDespesaFixa(this.usuario(auth), empresaId, body); }

  @Delete('despesas-fixas/:id')
  excluirFixa(@Headers('authorization') auth: string, @Headers('x-empresa-id') empresaId: string, @Param('id') id: string) { return this.service.inativarDespesaFixa(this.usuario(auth), empresaId, id); }

  @Get('produtos/:id/despesas-adicionais')
  listarAdicionais(@Headers('authorization') auth: string, @Headers('x-empresa-id') empresaId: string, @Param('id') id: string) { return this.service.listarAdicionais(this.usuario(auth), empresaId, id); }

  @Post('produtos/:id/despesas-adicionais')
  criarAdicional(@Headers('authorization') auth: string, @Headers('x-empresa-id') empresaId: string, @Param('id') id: string, @Body() body: { descricao: string; valor: number }) { return this.service.criarAdicional(this.usuario(auth), empresaId, id, body); }

  @Post('produtos/:id/precificacao/simular')
  simular(@Headers('authorization') auth: string, @Headers('x-empresa-id') empresaId: string, @Param('id') id: string, @Body() body: { lucroPercentual?: number }) { return this.service.simular(this.usuario(auth), empresaId, id, body.lucroPercentual ?? 30); }

  @Post('produtos/:id/precificacao')
  salvar(@Headers('authorization') auth: string, @Headers('x-empresa-id') empresaId: string, @Param('id') id: string, @Body() body: { lucroPercentual?: number }) { return this.service.salvar(this.usuario(auth), empresaId, id, body.lucroPercentual ?? 30); }

  @Get('produtos/:id/precificacoes')
  historico(@Headers('authorization') auth: string, @Headers('x-empresa-id') empresaId: string, @Param('id') id: string) { return this.service.historicoDoProduto(this.usuario(auth), empresaId, id); }

  @Post('precificacoes/:id/aplicar')
  aplicar(@Headers('authorization') auth: string, @Headers('x-empresa-id') empresaId: string, @Param('id') id: string) { return this.service.aplicar(this.usuario(auth), empresaId, id); }

  private usuario(auth: string) { return this.authService['validarToken'](auth ?? ''); }
}
