import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProdutosModule } from '../produtos/produtos.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, ProdutosModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
