import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Relationship } from './entities/relationship.entity';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { UpdateRelationshipDto } from './dto/update-relationship.dto';

@Injectable()
export class RelationshipsService {
  constructor(
    @InjectRepository(Relationship)
    private readonly relationshipsRepository: Repository<Relationship>,
  ) {}

  async create(createRelationshipDto: CreateRelationshipDto) {
    const relationship = this.relationshipsRepository.create({
      sourceCompanyId: createRelationshipDto.sourceCompanyId,
      targetCompanyId: createRelationshipDto.targetCompanyId,
      relationshipType: createRelationshipDto.relationshipType ?? '',
      productName: createRelationshipDto.productName ?? '',
      value: createRelationshipDto.value ?? 0,
      description: createRelationshipDto.description ?? '',
    });

    return this.relationshipsRepository.save(relationship);
  }

  async findAll() {
    return this.relationshipsRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string) {
    const relationship = await this.relationshipsRepository.findOne({
      where: { id },
    });

    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }

    return relationship;
  }

  async update(id: string, updateRelationshipDto: UpdateRelationshipDto) {
    const relationship = await this.relationshipsRepository.findOne({
      where: { id },
    });

    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }

    if (updateRelationshipDto.sourceCompanyId !== undefined) {
      relationship.sourceCompanyId = updateRelationshipDto.sourceCompanyId;
    }

    if (updateRelationshipDto.targetCompanyId !== undefined) {
      relationship.targetCompanyId = updateRelationshipDto.targetCompanyId;
    }

    if (updateRelationshipDto.relationshipType !== undefined) {
      relationship.relationshipType = updateRelationshipDto.relationshipType;
    }

    if (updateRelationshipDto.productName !== undefined) {
      relationship.productName = updateRelationshipDto.productName;
    }

    if (updateRelationshipDto.value !== undefined) {
      relationship.value = updateRelationshipDto.value;
    }

    if (updateRelationshipDto.description !== undefined) {
      relationship.description = updateRelationshipDto.description;
    }

    return this.relationshipsRepository.save(relationship);
  }

  async remove(id: string) {
    const relationship = await this.relationshipsRepository.findOne({
      where: { id },
    });

    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }

    await this.relationshipsRepository.delete(id);

    return {
      message: 'Relationship deleted successfully',
      id,
    };
  }
}
