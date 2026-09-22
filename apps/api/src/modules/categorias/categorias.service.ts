import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../auth/auth.service';

export type Categoria = {
  id: string;
  empresaId: string;
  nome: string;
  cor?: string | null;
  ativo: boolean;
  criadoEm: string;
};

@Injectable()
export class CategoriasService {
  private readonly categorias: Categoria[] = [];

  constructor(private readonly authService: AuthService) {}

  listar(empresaId: string) {
    return this.categorias.filter((categoria) => categoria.empresaId === empresaId);
  }

  criar(usuarioId: string, empresaId: string, input: { nome: string; cor?: string | null }) {
    this.validarAdmin(usuarioId, empresaId);
    const nome = input.nome?.trim();

    if (!nome || nome.length < 2) {
      throw new BadRequestException('O nome da categoria deve ter pelo menos 2 caracteres.');
    }

    const jaExiste = this.categorias.some(
      (categoria) =>
        categoria.empresaId === empresaId &&
        categoria.nome.toLowerCase() === nome.toLowerCase() &&
        categoria.ativo,
    );

    if (jaExiste) {
      throw new BadRequestException('Já existe uma categoria com esse nome na empresa.');
    }

    const categoria: Categoria = {
      id: randomUUID(),
      empresaId,
      nome,
      cor: input.cor ?? null,
      ativo: true,
      criadoEm: new Date().toISOString(),
    };

    this.categorias.push(categoria);
    return categoria;
  }

  atualizar(usuarioId: string, empresaId: string, categoriaId: string, input: { nome?: string; cor?: string | null }) {
    this.validarAdmin(usuarioId, empresaId);
    const categoria = this.categorias.find(
      (item) => item.id === categoriaId && item.empresaId === empresaId,
    );

    if (!categoria) {
      throw new BadRequestException('Categoria não encontrada.');
    }

    if (input.nome) {
      const nome = input.nome.trim();
      if (!nome || nome.length < 2) {
        throw new BadRequestException('O nome da categoria deve ter pelo menos 2 caracteres.');
      }

      const jaExiste = this.categorias.some(
        (item) =>
          item.empresaId === empresaId &&
          item.id !== categoriaId &&
          item.nome.toLowerCase() === nome.toLowerCase() &&
          item.ativo,
      );

      if (jaExiste) {
        throw new BadRequestException('Já existe uma categoria com esse nome.');
      }

      categoria.nome = nome;
    }

    if (input.cor !== undefined) {
      categoria.cor = input.cor ?? null;
    }

    return categoria;
  }

  inativar(usuarioId: string, empresaId: string, categoriaId: string) {
    this.validarAdmin(usuarioId, empresaId);
    const categoria = this.categorias.find(
      (item) => item.id === categoriaId && item.empresaId === empresaId,
    );

    if (!categoria) {
      throw new BadRequestException('Categoria não encontrada.');
    }

    categoria.ativo = false;
    return categoria;
  }

  excluir(usuarioId: string, empresaId: string, categoriaId: string) {
    this.validarAdmin(usuarioId, empresaId);
    const indice = this.categorias.findIndex(
      (item) => item.id === categoriaId && item.empresaId === empresaId,
    );

    if (indice === -1) {
      throw new BadRequestException('Categoria não encontrada.');
    }

    this.categorias.splice(indice, 1);
    return { ok: true };
  }

  private validarAdmin(usuarioId: string, empresaId: string) {
    const empresa = this.authService['vinculos']?.find(
      (vinculo: any) => vinculo.usuarioId === usuarioId && vinculo.empresaId === empresaId,
    );

    if (empresa?.papel !== 'admin') {
      throw new UnauthorizedException('Somente administradores podem gerenciar categorias.');
    }
  }
}
