import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    // Always compare against a hash (even a dummy one) to avoid leaking via
    // response-time whether the username exists.
    const hash = user?.passwordHash ?? '$2a$10$invalidsaltinvalidsaltinvalidsaltinva';
    const passwordMatches = await bcrypt.compare(password, hash);

    if (!user || !passwordMatches || !user.isActive) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const sessionToken = randomBytes(32).toString('hex');
    const sessionId = createHash('sha256').update(sessionToken).digest('hex');
    await this.prisma.adminSession.create({ data: { id: sessionId, userId: user.id } });
    const payload = { sub: user.id, username: user.username, role: user.role, sid: sessionToken };
    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      user: { id: user.id, name: user.name, username: user.username, role: user.role },
    };
  }

  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      await this.prisma.adminSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) throw new BadRequestException('Konfirmasi password baru tidak cocok.');
    if (Buffer.byteLength(dto.newPassword, 'utf8') > 72) throw new BadRequestException('Password baru maksimal 72 byte.');
    if (dto.currentPassword === dto.newPassword) throw new BadRequestException('Password baru harus berbeda dari password lama.');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException();
    if (!await bcrypt.compare(dto.currentPassword, user.passwordHash)) throw new BadRequestException('Password lama tidak sesuai.');
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const result = await this.prisma.user.updateMany({ where: { id: userId, passwordHash: user.passwordHash, isActive: true }, data: { passwordHash } });
    if (!result.count) throw new BadRequestException('Password telah berubah. Coba kembali dengan password terbaru.');
    return { ok: true };
  }
}
