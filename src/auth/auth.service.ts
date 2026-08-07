import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(signupDto: SignupDto) {
    const user = await this.usersService.create({
      name: signupDto.name ?? '',
      email: signupDto.email,
      password: signupDto.password,
      role: 'Viewer',
      status: 'Active',
    });

    const payload = this.createTokenPayload(user);

    return {
      message: 'Signup successful',
      user,
      accessToken: this.jwtService.sign(payload),
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatched = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!passwordMatched) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { password, ...safeUser } = user;
    void password;

    const payload = this.createTokenPayload(user);

    return {
      message: 'Login successful',
      user: safeUser,
      accessToken: this.jwtService.sign(payload),
    };
  }

  private createTokenPayload(user: {
    id: string;
    email: string;
    role: string;
  }) {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: process.env.AI_DEFAULT_TENANT_ID || 'default',
    };
  }
}
