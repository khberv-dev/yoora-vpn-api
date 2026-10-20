import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entity/user.entity.js';

export interface CreateUserInput {
  name: string;
  username: string;
  email: string;
  password: string;
}

export function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  findForAuth(login: string): Promise<User | null> {
    const value = normalizeLogin(login);
    return this.userRepo.findOne({
      where: value.includes('@') ? { email: value } : { username: value },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        password: true,
      },
    });
  }

  async create(input: CreateUserInput): Promise<User> {
    const username = normalizeLogin(input.username);
    const email = normalizeLogin(input.email);

    if (await this.userRepo.existsBy({ username })) {
      throw new ConflictException('Username is already taken');
    }
    if (await this.userRepo.existsBy({ email })) {
      throw new ConflictException('Email is already registered');
    }

    try {
      const { password: _password, ...user } = await this.userRepo.save(
        this.userRepo.create({ ...input, username, email }),
      );
      return user as User;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Username or email is already taken');
      }
      throw error;
    }
  }
}
