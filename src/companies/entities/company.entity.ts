import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true, default: '' })
  name!: string;

  @Column({ nullable: true, default: 'Level 1' })
  level!: string;

  @Column({ nullable: true, default: '' })
  country!: string;

  @Column({ nullable: true, default: '' })
  city!: string;

  @Column({ type: 'int', nullable: true })
  foundedYear!: number | null;

  @Column({ type: 'float', nullable: true, default: 0 })
  annualRevenue!: number | null;

  @Column({ type: 'int', nullable: true, default: 0 })
  employees!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
