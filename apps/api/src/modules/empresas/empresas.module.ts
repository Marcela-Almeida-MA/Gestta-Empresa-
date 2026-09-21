import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmpresasController } from './empresas.controller';

@Module({
  imports: [AuthModule],
  controllers: [EmpresasController],
})
export class EmpresasModule {}
