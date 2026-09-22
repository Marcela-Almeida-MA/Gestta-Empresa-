import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProdutosModule } from '../produtos/produtos.module';
import { PrecificacaoController } from './precificacao.controller';
import { PrecificacaoService } from './precificacao.service';

@Module({
  imports: [AuthModule, ProdutosModule],
  controllers: [PrecificacaoController],
  providers: [PrecificacaoService],
})
export class PrecificacaoModule {}
