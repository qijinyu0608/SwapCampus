import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class SendMessageDto {
  @IsInt()
  senderId!: number;

  @IsString()
  @IsNotEmpty()
  content!: string;
}
