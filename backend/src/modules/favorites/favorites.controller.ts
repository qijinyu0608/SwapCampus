import { Controller, Delete, Get, Inject, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(
    @Inject(FavoritesService)
    private readonly favoritesService: FavoritesService
  ) {}

  @Get()
  listFavorites(@CurrentUser() user: AuthenticatedUser) {
    return this.favoritesService.listFavorites(user);
  }

  @Post(':productId')
  addFavorite(
    @Param('productId', ParseIntPipe) productId: number,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.favoritesService.addFavorite(productId, user);
  }

  @Delete(':productId')
  removeFavorite(
    @Param('productId', ParseIntPipe) productId: number,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.favoritesService.removeFavorite(productId, user);
  }
}
