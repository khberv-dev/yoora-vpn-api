import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { User } from '../entity/user.entity.js';

@Controller('users')
export class UserController {
  @Get('me')
  getMe(@CurrentUser() user: User) {
    return user;
  }
}
