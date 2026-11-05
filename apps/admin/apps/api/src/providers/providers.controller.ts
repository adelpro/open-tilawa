import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JWTAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProviderRegistry } from './provider.registry';

@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('providers')
export class ProvidersController {
  constructor(private readonly registry: ProviderRegistry) {}

  @Get()
  list(): { providers: { id: string; label: string }[] } {
    return { providers: this.registry.list() };
  }

  @Get(':provider/search')
  async search(
    @Param('provider') provider: string,
    @Query('q') query?: string,
  ): Promise<unknown> {
    return { results: await this.registry.get(provider).search(query ?? '') };
  }

  @Get(':provider/releases/:reciterId/:releaseId')
  release(
    @Param('provider') provider: string,
    @Param('reciterId') reciterId: string,
    @Param('releaseId') releaseId: string,
    @Query('variant') variant?: string,
  ): Promise<unknown> {
    return this.registry.get(provider).release(reciterId, releaseId, variant);
  }
}
