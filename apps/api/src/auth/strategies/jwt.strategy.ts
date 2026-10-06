import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'change-me',
    });
  }

  async validate(payload: { sub: string; username: string; role: string; sid?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is inactive or no longer exists');
    }

    // Tokens issued before persistent sessions remain valid only until their
    // original 12-hour expiry. New tokens are revoked by the explicit logout.
    let sessionId: string | undefined;
    if (payload.sid) {
      sessionId = createHash('sha256').update(payload.sid).digest('hex');
      const session = await this.prisma.adminSession.findFirst({
        where: { id: sessionId, userId: user.id, revokedAt: null },
        select: { id: true },
      });
      if (!session) throw new UnauthorizedException('Sesi telah berakhir. Silakan login kembali.');
    }

    return { sub: user.id, username: user.username, role: user.role, sessionId };
  }
}
