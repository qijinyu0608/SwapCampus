import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';

@Controller('products')
export class ProductsController {
  constructor(
    @Inject(ProductsService)
    private readonly productsService: ProductsService
  ) {}

  @Get()
  listProducts() {
    return this.productsService.listProducts();
  }

  @Get('recommendations')
  getRecommendations(@Query('userId') userId?: string) {
    return this.productsService.getRecommendations(userId ? Number(userId) : undefined);
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
    @Query('userId') userId?: string
  ) {
    return this.productsService.getProductDetail(id, userId ? Number(userId) : undefined);
  }

  @Post()
  createProduct(@Body() payload: CreateProductDto) {
    return this.productsService.createProduct(payload);
  }
}
