import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsIn(['Admin', 'Manager', 'Operator', 'Viewer'])
  role?: string;

  @IsOptional()
  @IsIn(['Active', 'Pending', 'Disabled'])
  status?: string;
}
