import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { ProdutosModule } from './modules/produtos/produtos.module';
import { PrecificacaoModule } from './modules/precificacao/precificacao.module';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [AuthModule, EmpresasModule, CategoriasModule, ProdutosModule, DashboardModule, PrecificacaoModule],
  controllers: [AppController],
  providers: [AppService, SupabaseService],
})
export class AppModule {}
