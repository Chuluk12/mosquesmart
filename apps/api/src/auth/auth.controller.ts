import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.sub);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.sub, dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout() {
    // JWTs are stateless; logout is handled client-side by discarding the token.
    return { ok: true };
  }
}
