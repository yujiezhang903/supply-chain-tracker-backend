import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsIn(['Admin', 'Manager', 'Operator', 'Viewer'])
  role?: string;

  @IsOptional()
  @IsIn(['Active', 'Pending', 'Disabled'])
  status?: string;
}
