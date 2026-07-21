import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  private removePassword(user: User) {
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }

  async findAll() {
    const users = await this.usersRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });

    return users.map((user) => this.removePassword(user));
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.removePassword(user);
  }

  async findByEmail(email: string) {
    return this.usersRepository.findOne({
      where: { email },
    });
  }

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.findByEmail(createUserDto.email);

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      name: createUserDto.name ?? '',
      email: createUserDto.email,
      password: hashedPassword,
      role: createUserDto.role ?? 'Viewer',
      status: createUserDto.status ?? 'Active',
    });

    const savedUser = await this.usersRepository.save(user);

    return this.removePassword(savedUser);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }

      user.email = updateUserDto.email;
    }

    if (updateUserDto.name !== undefined) {
      user.name = updateUserDto.name;
    }

    if (updateUserDto.password !== undefined) {
      user.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    if (updateUserDto.role !== undefined) {
      user.role = updateUserDto.role;
    }

    if (updateUserDto.status !== undefined) {
      user.status = updateUserDto.status;
    }

    const updatedUser = await this.usersRepository.save(user);

    return this.removePassword(updatedUser);
  }

  async remove(id: string) {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersRepository.delete(id);

    return {
      message: 'User deleted successfully',
      id,
    };
  }

  async removeBulk(ids: string[]) {
    const users = await this.usersRepository.find({
      where: {
        id: In(ids),
      },
    });

    if (users.length === 0) {
      throw new NotFoundException('No users found');
    }

    await this.usersRepository.delete(ids);

    return {
      message: 'Users deleted successfully',
      deletedCount: users.length,
      ids: users.map((user) => user.id),
    };
  }
}
