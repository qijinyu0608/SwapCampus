import { Controller, Delete, Get, Inject, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampusServiceFavoritesService } from './campus-service-favorites.service';

@Controller('campus-service-favorites')
@UseGuards(JwtAuthGuard)
export class CampusServiceFavoritesController {
  constructor(
    @Inject(CampusServiceFavoritesService)
    private readonly campusServiceFavoritesService: CampusServiceFavoritesService
  ) {}

  @Get()
  listFavorites(@CurrentUser() user: AuthenticatedUser) {
    return this.campusServiceFavoritesService.listFavorites(user);
  }

  @Post(':listingId')
  addFavorite(
    @Param('listingId', ParseIntPipe) listingId: number,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServiceFavoritesService.addFavorite(listingId, user);
  }

  @Delete(':listingId')
  removeFavorite(
    @Param('listingId', ParseIntPipe) listingId: number,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.campusServiceFavoritesService.removeFavorite(listingId, user);
  }
}
