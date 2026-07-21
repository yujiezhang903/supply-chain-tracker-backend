import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRelationshipDto {
  @IsString()
  @IsNotEmpty()
  sourceCompanyId!: string;

  @IsString()
  @IsNotEmpty()
  targetCompanyId!: string;

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
