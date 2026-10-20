import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class CreateRoomDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  memberIds: string[];
}
