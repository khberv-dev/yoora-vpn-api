import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Matches(/^[a-zA-Z0-9_.]{3,32}$/, {
    message: 'username must be 3-32 characters of letters, digits, "_" or "."',
  })
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
