import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types';
import { NotificationsFeedService } from '../services/notifications-feed.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly feed: NotificationsFeedService) {}

  @Get()
  @ApiOperation({ summary: 'Список уведомлений (?unreadOnly=true|false)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.feed.list(user.id, {
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 30,
      unreadOnly: unreadOnly === 'true' || unreadOnly === '1',
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Число непрочитанных (для badge)' })
  unread(@CurrentUser() user: AuthenticatedUser) {
    return this.feed.unreadCount(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Отметить прочитанным' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.feed.markRead(user.id, id);
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отметить все прочитанными' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.feed.markAllRead(user.id);
  }
}
