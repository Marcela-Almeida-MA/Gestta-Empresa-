import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Patch,
  Post,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@Controller('empresas')
export class EmpresasController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  async listar(@Headers('authorization') authorization?: string) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    return this.authService.listarEmpresasDoUsuario(usuarioId);
  }

  @Post()
  async criar(@Headers('authorization') authorization: string, @Body() body: { nome: string; documento?: string | null; unidadesMesEstimadas?: number }) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    return this.authService.criarEmpresa(usuarioId, body);
  }

  @Get('atual')
  async atual(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId?: string) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    return this.authService.obterEmpresaDoUsuario(usuarioId, empresaId ?? '');
  }

  @Patch('atual')
  async atualizar(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string, @Body() body: { nome?: string; documento?: string | null; unidadesMesEstimadas?: number }) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    return this.authService.atualizarEmpresa(usuarioId, empresaId, body);
  }

  @Delete('atual')
  async excluir(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    return {
      usuarioId,
      empresaId,
      mensagem: 'Exclusão de empresa ainda não implementada no MVP em memória.',
    };
  }
}
