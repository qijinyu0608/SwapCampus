import { IsIn, IsOptional, IsString } from 'class-validator';
import { MEDIA_PURPOSES } from '../media.constants';

export class UploadImageDto {
  @IsString()
  @IsOptional()
  @IsIn(Object.values(MEDIA_PURPOSES))
  purpose?: (typeof MEDIA_PURPOSES)[keyof typeof MEDIA_PURPOSES];
}
