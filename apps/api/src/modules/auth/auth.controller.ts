import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
} from '@nestjs/common';
import { AuthService, LoginInput, RegisterInput } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterInput) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: LoginInput) {
    return this.authService.login(body);
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    return this.authService.me(authorization ?? '');
  }
}
