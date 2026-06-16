import { CampusServiceFavoritesController } from './campus-service-favorites.controller';

describe('CampusServiceFavoritesController', () => {
  it('delegates campus service favorite operations', () => {
    const campusServiceFavoritesService = {
      listFavorites: jest.fn(),
      addFavorite: jest.fn(),
      removeFavorite: jest.fn()
    } as any;
    const controller = new CampusServiceFavoritesController(campusServiceFavoritesService);
    const user = { id: 1 } as any;
    controller.listFavorites(user);
    controller.addFavorite(4, user);
    controller.removeFavorite(4, user);
    expect(campusServiceFavoritesService.listFavorites).toHaveBeenCalledWith(user);
    expect(campusServiceFavoritesService.addFavorite).toHaveBeenCalledWith(4, user);
    expect(campusServiceFavoritesService.removeFavorite).toHaveBeenCalledWith(4, user);
  });
});
