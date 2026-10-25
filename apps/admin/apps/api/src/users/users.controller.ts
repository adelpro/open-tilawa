import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JWTAuthGuard } from '@/auth/guards/jwt.guard';
import { RoleGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import type { User } from '@tilawa-admin/core';
import { UpdateUserDTO } from '@/auth/dtos/updateUser.dto';
import { Response } from 'express';

/**
 * The user list. Ported from nextpalestine, where it was open — every route now
 * sits behind the JWT guard, and writes require `admin`. Reading another
 * account is an administrative act, not a public one.
 */
@UseGuards(JWTAuthGuard, RoleGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Get()
  @Roles('admin')
  async getAll(@Res() response: Response): Promise<Response> {
    const users = await this.userService.getAll();
    return response.status(HttpStatus.OK).json({ users });
  }

  @Get('/:id')
  @Roles('admin')
  async getUserById(@Res() response: Response, @Param('id') id: string): Promise<Response> {
    const user = await this.userService.getUserById(id);
    return response.status(HttpStatus.OK).json({ user });
  }

  @Put('/:id')
  @Roles('admin')
  async update(
    @Res() response: Response,
    @Param('id') id: string,
    @Body() updateUser: UpdateUserDTO,
  ): Promise<Response> {
    const updatedUser = await this.userService.update(id, updateUser.user as Partial<User>);
    return response.status(HttpStatus.OK).json({ updatedUser });
  }

  @Delete('/:id')
  @Roles('admin')
  async delete(@Res() response: Response, @Param('id') id: string): Promise<Response> {
    const deletedUser = await this.userService.delete(id);
    return response.status(HttpStatus.OK).json({ deletedUser });
  }
}
