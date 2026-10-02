import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ApproveCycleDto, CreatePlaylistDto, PlaylistSettingsDto, UpdatePlaylistAudiosDto } from './playlist.dto';
import { QuotePlaylistService } from './playlist.service';

@Controller('quote-playlists')
export class QuotePlaylistController {
  constructor(private service: QuotePlaylistService) {}
  @Get() list() { return this.service.list(); }
  @Post() @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  create(@Body() dto: CreatePlaylistDto) { return this.service.create(dto); }
  @Patch(':id') @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  update(@Param('id') id: string, @Body() dto: PlaylistSettingsDto) { return this.service.update(id, dto); }
  @Patch(':id/audios') @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  updateAudios(@Param('id') id: string, @Body() dto: UpdatePlaylistAudiosDto) { return this.service.updateAudios(id, dto); }
  @Delete(':id') @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string) { return this.service.remove(id); }
  @Post(':id/runs/:runId/resolve') @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  resolve(@Param('id') id: string, @Param('runId') runId: string, @CurrentUser() user: AuthUser) {
    return this.service.resolveInterrupted(id, runId, user.sub);
  }  @Post(':id/approve-repeat') @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  approve(@Param('id') id: string, @Body() dto: ApproveCycleDto, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, dto.cycle, user.sub);
  }
}