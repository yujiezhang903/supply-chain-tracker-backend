import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsString()
  @IsNotEmpty()
  country!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  foundedYear?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualRevenue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  employees?: number;
}
