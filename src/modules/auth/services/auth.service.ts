import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../user/services/user.service.js';
import { SignUpDto } from '../dto/sign-up.dto.js';
import { SignInDto } from '../dto/sign-in.dto.js';
import {
  comparePassword,
  hashPassword,
} from '../../../shared/utils/hash.util.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  issueTokens(userId: string) {
    const payload = { sub: userId };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow('JWT_REFRESH_EXPIRE'),
    });

    return { accessToken, refreshToken };
  }

  async signUp(dto: SignUpDto) {
    const user = await this.userService.create({
      name: dto.name,
      username: dto.username,
      email: dto.email,
      password: await hashPassword(dto.password),
    });

    return { user, ...this.issueTokens(user.id) };
  }

  async signIn(dto: SignInDto) {
    const account = await this.userService.findForAuth(dto.login);
    if (!account || !(await comparePassword(dto.password, account.password))) {
      throw new BadRequestException('Invalid login or password');
    }

    const { password: _password, ...user } = account;
    return { user, ...this.issueTokens(user.id) };
  }

  refresh(userId: string) {
    return this.issueTokens(userId);
  }
}
