import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ContentService } from './content.service';
import { CreateContentDto, UpdateContentDto } from './dto/content.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('contents')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  list(@Query('activeOnly') activeOnly?: string) {
    return this.contentService.list(activeOnly === 'true');
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  create(@Body() dto: CreateContentDto) {
    return this.contentService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  update(@Param('id') id: string, @Body() dto: UpdateContentDto) {
    return this.contentService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.contentService.remove(id);
  }
}
