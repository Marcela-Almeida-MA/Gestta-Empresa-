import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { CategoriasService } from './categorias.service';

@Controller('categorias')
export class CategoriasController {
  constructor(
    private readonly categoriasService: CategoriasService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  listar(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    return this.categoriasService.listar(empresaId);
  }

  @Post()
  criar(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string, @Body() body: { nome: string; cor?: string | null }) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    return this.categoriasService.criar(usuarioId, empresaId, body);
  }

  @Patch(':id')
  atualizar(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string, @Param('id') id: string, @Body() body: { nome?: string; cor?: string | null }) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    return this.categoriasService.atualizar(usuarioId, empresaId, id, body);
  }

  @Patch(':id/inativar')
  inativar(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string, @Param('id') id: string) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    return this.categoriasService.inativar(usuarioId, empresaId, id);
  }

  @Delete(':id')
  excluir(@Headers('authorization') authorization: string, @Headers('x-empresa-id') empresaId: string, @Param('id') id: string) {
    const usuarioId = this.authService['validarToken'](authorization ?? '');
    this.authService.obterEmpresaDoUsuario(usuarioId, empresaId);
    return this.categoriasService.excluir(usuarioId, empresaId, id);
  }
}
