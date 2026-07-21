import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class FoundedYearRangeDto {
  @IsOptional()
  @IsInt()
  start?: number;

  @IsOptional()
  @IsInt()
  end?: number;
}

class NumberRangeDto {
  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;
}

class CompanyFiltersDto {
  @IsOptional()
  @IsArray()
  level?: Array<string | number>;

  @IsOptional()
  @IsArray()
  country?: string[];

  @IsOptional()
  @IsArray()
  city?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FoundedYearRangeDto)
  founded_year?: FoundedYearRangeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NumberRangeDto)
  annual_revenue?: NumberRangeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NumberRangeDto)
  employees?: NumberRangeDto;
}

export class CompanyFilterDto {
  @IsIn(['level', 'country', 'city'])
  dimension!: 'level' | 'country' | 'city';

  @IsOptional()
  @ValidateNested()
  @Type(() => CompanyFiltersDto)
  filter?: CompanyFiltersDto;
}
