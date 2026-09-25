import { Body, Controller, Get, Put } from '@nestjs/common';
import { MosqueService } from './mosque.service';
import { UpdateMosqueDto } from './dto/update-mosque.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';

@Controller('mosque')
export class MosqueController {
  constructor(private readonly mosqueService: MosqueService) {}

  // Public: the Display TV app reads this without logging in.
  @Public()
  @Get()
  get() {
    return this.mosqueService.get();
  }

  @Put()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  update(@Body() dto: UpdateMosqueDto) {
    return this.mosqueService.update(dto);
  }
}
