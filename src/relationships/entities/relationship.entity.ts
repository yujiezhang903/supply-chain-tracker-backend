import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('relationships')
export class Relationship {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  sourceCompanyId!: string;

  @Column()
  targetCompanyId!: string;

  @Column({ nullable: true, default: '' })
  relationshipType!: string;

  @Column({ nullable: true, default: '' })
  productName!: string;

  @Column({ type: 'float', nullable: true, default: 0 })
  value!: number | null;

  @Column({ nullable: true, default: '' })
  description!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
