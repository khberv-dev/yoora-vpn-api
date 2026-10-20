import { Controller, Post } from '@nestjs/common';
import { ConnectionService } from '../services/connection.service.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { User } from '../../user/entity/user.entity.js';

@Controller('connection')
export class ConnectionController {
  constructor(private readonly connectionService: ConnectionService) {}

  @Post()
  connect(@CurrentUser() user: User) {
    return this.connectionService.connect(user.id);
  }
}
