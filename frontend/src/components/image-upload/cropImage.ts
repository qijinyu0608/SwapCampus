type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function createImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export async function cropImageToBlob(params: {
  imageSrc: string;
  cropArea: CropArea;
  outputWidth: number;
  outputHeight?: number;
  circular?: boolean;
  mimeType?: string;
  quality?: number;
}) {
  const image = await createImage(params.imageSrc);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('当前浏览器不支持图像裁剪');
  }

  const width = params.outputWidth;
  const height = params.outputHeight ?? params.outputWidth;
  canvas.width = width;
  canvas.height = height;

  if (params.circular) {
    context.beginPath();
    context.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
    context.closePath();
    context.clip();
  }

  context.drawImage(
    image,
    params.cropArea.x,
    params.cropArea.y,
    params.cropArea.width,
    params.cropArea.height,
    0,
    0,
    width,
    height
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('裁剪后的图片生成失败'));
        return;
      }
      resolve(blob);
    }, params.mimeType ?? 'image/png', params.quality ?? 0.92);
  });
}
