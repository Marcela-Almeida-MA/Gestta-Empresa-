import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { ProdutosModule } from './modules/produtos/produtos.module';

@Module({
  imports: [AuthModule, EmpresasModule, CategoriasModule, ProdutosModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
