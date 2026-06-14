import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TEXT', 'IMAGE', 'VIDEO', 'EMOJI'])
  type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'EMOJI';

  @IsOptional()
  @IsObject()
  attachment?: {
    objectKey?: string;
    url?: string;
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
    originalName?: string;
  };
}
