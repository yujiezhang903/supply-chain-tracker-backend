import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateRelationshipDto {
  @IsOptional()
  @IsString()
  sourceCompanyId?: string;

  @IsOptional()
  @IsString()
  targetCompanyId?: string;

  @IsOptional()
  @IsString()
  relationshipType?: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
