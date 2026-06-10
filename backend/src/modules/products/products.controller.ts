import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { SessionRequest } from '../auth/supertokens.types';
import { resolveOptionalAuthUser } from '../auth/auth-request.utils';

@Controller('products')
export class ProductsController {
  constructor(
    @Inject(ProductsService)
    private readonly productsService: ProductsService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  @Get()
  searchProducts(@Query() query: SearchProductsDto) {
    return this.productsService.searchProducts(query);
  }

  @Get('home-recommendations')
  getHomeRecommendations(@Req() request: SessionRequest) {
    const session = request.session;
    const accessTokenPayload = session?.getAccessTokenPayload();
    const currentUserId = accessTokenPayload ? Number(accessTokenPayload.userId) : undefined;
    return this.productsService.getHomeRecommendations(currentUserId);
  }

  @Get('publishing-rules')
  getPublishingRules() {
    return this.productsService.getPublishingRules();
  }

  @Get('dashboard')
  getDashboardStats() {
    return this.productsService.getDashboardStats();
  }

  @Get('stats')
  getStats() {
    return this.productsService.getDashboardStats();
  }

  @Get(':id')
  getProductDetail(
    @Param('id', ParseIntPipe) id: number,
    @Req() request?: SessionRequest
  ) {
    return resolveOptionalAuthUser(this.prisma, (request ?? {}) as SessionRequest & { user?: AuthenticatedUser })
      .then((user) => this.productsService.getProductDetail(id, user?.id));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createProduct(
    @Body() payload: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.productsService.createProduct(payload, user);
  }
}
