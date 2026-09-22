import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

export type PapelEmpresa = 'admin' | 'operador';

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  senha: string;
  criadoEm: string;
};

export type Empresa = {
  id: string;
  nome: string;
  documento: string | null;
  criadoEm: string;
  unidadesMesEstimadas: number;
  fotoUrl: string | null;
  descricao: string;
  slogan: string;
  paleta: 'folha' | 'oceano' | 'grafite' | 'terracota';
};

export type VinculoEmpresa = {
  id: string;
  usuarioId: string;
  empresaId: string;
  papel: PapelEmpresa;
  criadoEm: string;
};

export type RegisterInput = {
  nome: string;
  email: string;
  senha: string;
  empresaNome: string;
  documento?: string | null;
  unidadesMesEstimadas?: number;
  fotoUrl?: string | null;
  descricao?: string;
  slogan?: string;
  paleta?: Empresa['paleta'];
};

export type LoginInput = {
  email: string;
  senha: string;
};

@Injectable()
export class AuthService {
  private readonly usuarios: Usuario[] = [];
  private readonly empresas: Empresa[] = [];
  private readonly vinculos: VinculoEmpresa[] = [];

  constructor() {
    const usuarioId = randomUUID();
    const empresaId = randomUUID();
    const agora = new Date().toISOString();

    this.usuarios.push({
      id: usuarioId,
      nome: 'Admin Demo',
      email: 'admin@gestta.com',
      senha: '12345678',
      criadoEm: agora,
    });

    this.empresas.push({
      id: empresaId,
      nome: 'Empresa Demo',
      documento: null,
      criadoEm: agora,
      unidadesMesEstimadas: 300,
      fotoUrl: null,
      descricao: 'Operação, estoque e resultados em um só lugar.',
      slogan: 'Clareza para crescer.',
      paleta: 'folha',
    });

    this.vinculos.push({
      id: randomUUID(),
      usuarioId: usuarioId,
      empresaId: empresaId,
      papel: 'admin',
      criadoEm: agora,
    });
  }

  async register(input: RegisterInput) {
    this.validarNome(input.nome);
    this.validarEmail(input.email);
    this.validarSenha(input.senha);
    this.validarEmpresa(input.empresaNome, input.unidadesMesEstimadas ?? 1);

    const emailJaExiste = this.usuarios.some(
      (usuario) => usuario.email.toLowerCase() === input.email.toLowerCase(),
    );

    if (emailJaExiste) {
      throw new BadRequestException('E-mail já cadastrado.');
    }

    const usuario: Usuario = {
      id: randomUUID(),
      nome: input.nome,
      email: input.email,
      senha: input.senha,
      criadoEm: new Date().toISOString(),
    };

    const empresa: Empresa = {
      id: randomUUID(),
      nome: input.empresaNome,
      documento: input.documento ?? null,
      criadoEm: new Date().toISOString(),
      unidadesMesEstimadas: Number(input.unidadesMesEstimadas ?? 1),
      fotoUrl: input.fotoUrl ?? null,
      descricao: input.descricao ?? '',
      slogan: input.slogan ?? '',
      paleta: input.paleta ?? 'folha',
    };

    this.usuarios.push(usuario);
    this.empresas.push(empresa);
    this.vinculos.push({
      id: randomUUID(),
      usuarioId: usuario.id,
      empresaId: empresa.id,
      papel: 'admin',
      criadoEm: new Date().toISOString(),
    });

    return this.buildSession(usuario, empresa);
  }

  async login(input: LoginInput) {
    const usuario = this.usuarios.find(
      (item) => item.email.toLowerCase() === input.email.toLowerCase(),
    );

    if (usuario?.senha !== input.senha) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const empresas = this.listarEmpresasDoUsuario(usuario.id);
    const empresaAtual = empresas[0];

    return {
      token: this.gerarToken(usuario.id),
      user: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
      },
      empresaAtual,
      empresas,
    };
  }

  me(token: string) {
    const usuarioId = this.validarToken(token);
    const usuario = this.usuarios.find((item) => item.id === usuarioId);

    if (!usuario) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
    };
  }

  listarEmpresasDoUsuario(usuarioId: string) {
    return this.vinculos
      .filter((vinculo) => vinculo.usuarioId === usuarioId)
      .map((vinculo) => {
        const empresa = this.empresas.find((item) => item.id === vinculo.empresaId);

        return empresa
          ? {
              id: empresa.id,
              nome: empresa.nome,
              documento: empresa.documento,
              papel: vinculo.papel,
              unidadesMesEstimadas: empresa.unidadesMesEstimadas,
              fotoUrl: empresa.fotoUrl,
              descricao: empresa.descricao,
              slogan: empresa.slogan,
              paleta: empresa.paleta,
              criadoEm: empresa.criadoEm,
            }
          : null;
      })
      .filter(Boolean);
  }

  criarEmpresa(usuarioId: string, input: { nome: string; documento?: string | null; unidadesMesEstimadas?: number; fotoUrl?: string | null; descricao?: string; slogan?: string; paleta?: Empresa['paleta'] }) {
    this.validarEmpresa(input.nome, input.unidadesMesEstimadas ?? 1);

    const empresa: Empresa = {
      id: randomUUID(),
      nome: input.nome,
      documento: input.documento ?? null,
      criadoEm: new Date().toISOString(),
      unidadesMesEstimadas: Number(input.unidadesMesEstimadas ?? 1),
      fotoUrl: input.fotoUrl ?? null,
      descricao: input.descricao ?? '',
      slogan: input.slogan ?? '',
      paleta: input.paleta ?? 'folha',
    };

    this.empresas.push(empresa);
    this.vinculos.push({
      id: randomUUID(),
      usuarioId,
      empresaId: empresa.id,
      papel: 'admin',
      criadoEm: new Date().toISOString(),
    });

    return {
      id: empresa.id,
      nome: empresa.nome,
      documento: empresa.documento,
      papel: 'admin',
      unidadesMesEstimadas: empresa.unidadesMesEstimadas,
      fotoUrl: empresa.fotoUrl,
      descricao: empresa.descricao,
      slogan: empresa.slogan,
      paleta: empresa.paleta,
      criadoEm: empresa.criadoEm,
    };
  }

  obterEmpresaDoUsuario(usuarioId: string, empresaId: string) {
    const vinculo = this.vinculos.find(
      (item) => item.usuarioId === usuarioId && item.empresaId === empresaId,
    );

    if (!vinculo) {
      throw new UnauthorizedException('Usuário não participa desta empresa.');
    }

    const empresa = this.empresas.find((item) => item.id === empresaId);
    if (!empresa) {
      throw new BadRequestException('Empresa não encontrada.');
    }

    return {
      id: empresa.id,
      nome: empresa.nome,
      documento: empresa.documento,
      papel: vinculo.papel,
      unidadesMesEstimadas: empresa.unidadesMesEstimadas,
      fotoUrl: empresa.fotoUrl,
      descricao: empresa.descricao,
      slogan: empresa.slogan,
      paleta: empresa.paleta,
      criadoEm: empresa.criadoEm,
    };
  }

  atualizarEmpresa(usuarioId: string, empresaId: string, input: { nome?: string; documento?: string | null; unidadesMesEstimadas?: number; fotoUrl?: string | null; descricao?: string; slogan?: string; paleta?: Empresa['paleta'] }) {
    const isAdmin = this.vinculos.some(
      (item) => item.usuarioId === usuarioId && item.empresaId === empresaId && item.papel === 'admin',
    );

    if (!isAdmin) {
      throw new UnauthorizedException('Apenas administradores podem alterar a empresa.');
    }

    const empresa = this.empresas.find((item) => item.id === empresaId);
    if (!empresa) {
      throw new BadRequestException('Empresa não encontrada.');
    }

    if (input.nome) {
      this.validarEmpresa(input.nome, input.unidadesMesEstimadas ?? empresa.unidadesMesEstimadas);
      empresa.nome = input.nome;
    }

    if (typeof input.unidadesMesEstimadas === 'number') {
      this.validarEmpresa(empresa.nome, input.unidadesMesEstimadas);
      empresa.unidadesMesEstimadas = input.unidadesMesEstimadas;
    }

    if (input.documento !== undefined) {
      empresa.documento = input.documento ?? null;
    }

    if (input.fotoUrl !== undefined) {
      empresa.fotoUrl = input.fotoUrl ?? null;
    }

    if (input.descricao !== undefined) empresa.descricao = input.descricao.trim();
    if (input.slogan !== undefined) empresa.slogan = input.slogan.trim();
    if (input.paleta !== undefined) empresa.paleta = input.paleta;

    return this.obterEmpresaDoUsuario(usuarioId, empresaId);
  }

  private buildSession(usuario: Usuario, empresa: Empresa) {
    return {
      token: this.gerarToken(usuario.id),
      user: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
      },
      empresaAtual: {
        id: empresa.id,
        nome: empresa.nome,
        documento: empresa.documento,
        papel: 'admin',
        unidadesMesEstimadas: empresa.unidadesMesEstimadas,
        fotoUrl: empresa.fotoUrl,
        descricao: empresa.descricao,
        slogan: empresa.slogan,
        paleta: empresa.paleta,
        criadoEm: empresa.criadoEm,
      },
      empresas: this.listarEmpresasDoUsuario(usuario.id),
    };
  }

  private gerarToken(usuarioId: string) {
    return `mock-token-${usuarioId}`;
  }

  private validarToken(token: string) {
    const valor = token?.replace(/^Bearer\s+/i, '').trim();
    if (!valor?.startsWith('mock-token-')) {
      throw new UnauthorizedException('Token inválido.');
    }

    const usuarioId = valor.replace('mock-token-', '');
    if (!this.usuarios.some((usuario) => usuario.id === usuarioId)) {
      throw new UnauthorizedException('Usuário não encontrado nesta sessão.');
    }

    return usuarioId;
  }

  private validarNome(nome: string) {
    if (!nome || nome.trim().length < 2) {
      throw new BadRequestException('O nome deve ter no mínimo 2 caracteres.');
    }
  }

  private validarEmail(email: string) {
    if (!email?.includes('@')) {
      throw new BadRequestException('E-mail inválido.');
    }
  }

  private validarSenha(senha: string) {
    if (!senha || senha.length < 8) {
      throw new BadRequestException('A senha deve ter pelo menos 8 caracteres.');
    }
  }

  private validarEmpresa(nome: string, unidadesMesEstimadas: number) {
    if (!nome || nome.trim().length < 2) {
      throw new BadRequestException('O nome da empresa é obrigatório.');
    }

    if (!Number.isFinite(unidadesMesEstimadas) || unidadesMesEstimadas < 1) {
      throw new BadRequestException('A estimativa de unidades por mês deve ser um número maior ou igual a 1.');
    }
  }
}
