import { FavoritesController } from './favorites.controller';

describe('FavoritesController', () => {
  it('delegates product favorite operations', () => {
    const favoritesService = {
      listFavorites: jest.fn(),
      addFavorite: jest.fn(),
      removeFavorite: jest.fn()
    } as any;
    const controller = new FavoritesController(favoritesService);
    const user = { id: 1 } as any;
    controller.listFavorites(user);
    controller.addFavorite(4, user);
    controller.removeFavorite(4, user);
    expect(favoritesService.listFavorites).toHaveBeenCalledWith(user);
    expect(favoritesService.addFavorite).toHaveBeenCalledWith(4, user);
    expect(favoritesService.removeFavorite).toHaveBeenCalledWith(4, user);
  });
});
