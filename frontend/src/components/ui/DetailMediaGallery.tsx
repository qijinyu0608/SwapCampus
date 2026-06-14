type DetailMediaGalleryProps = {
  images: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  title: string;
  galleryKey: string | number;
};

export function DetailMediaGallery({
  images,
  activeIndex,
  onSelect,
  title,
  galleryKey
}: DetailMediaGalleryProps) {
  const currentImage = images[activeIndex] ?? images[0] ?? '';

  return (
    <div className="detail-main-layout-product">
      <div className="detail-thumb-column">
        {images.map((image, index) => (
          <button
            key={`${galleryKey}-${index}`}
            type="button"
            className={index === activeIndex ? 'detail-thumb active' : 'detail-thumb'}
            onClick={() => onSelect(index)}
          >
            <img src={image} alt={`${title}-${index + 1}`} />
          </button>
        ))}
      </div>

      <div className="detail-main-photo-shell">
        <img
          className="detail-main-photo"
          src={currentImage}
          alt={title}
        />
      </div>
    </div>
  );
}
